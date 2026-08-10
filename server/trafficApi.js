import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'
import { discoverCapabilities } from './capabilities.js'
import { getTranslationStatus, readTranslations, translatePending } from './translateCapabilities.js'

const DB_PATH = 'C:/Users/Administrator/AppData/Local/hermes/state.db'

function openDb() {
  if (!existsSync(DB_PATH)) return null
  try {
    return new DatabaseSync(DB_PATH, { readOnly: true })
  } catch (error) {
    return { error: String(error) }
  }
}

function queryAll(db, sql, ...params) {
  try {
    return { rows: db.prepare(sql).all(...params) }
  } catch (error) {
    return { error: String(error) }
  }
}

function sendJson(res, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}

function overviewQuery(db) {
  return queryAll(db, `
    SELECT
      COUNT(*) AS session_count,
      COALESCE(SUM(input_tokens), 0) AS input_tokens,
      COALESCE(SUM(output_tokens), 0) AS output_tokens,
      COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens,
      COALESCE(SUM(cache_write_tokens), 0) AS cache_write_tokens,
      COALESCE(SUM(reasoning_tokens), 0) AS reasoning_tokens,
      COALESCE(SUM(api_call_count), 0) AS api_call_count,
      COALESCE(SUM(tool_call_count), 0) AS tool_call_count,
      COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd,
      COALESCE(SUM(actual_cost_usd), 0) AS actual_cost_usd
    FROM sessions
  `)
}

function trendQuery(db) {
  return queryAll(db, `
    SELECT
      date(started_at, 'unixepoch') AS day,
      COUNT(*) AS sessions,
      COALESCE(SUM(input_tokens + output_tokens + cache_read_tokens + cache_write_tokens + reasoning_tokens), 0) AS tokens
    FROM sessions
    WHERE started_at IS NOT NULL
    GROUP BY day
    ORDER BY day DESC
    LIMIT 14
  `)
}

function modelsQuery(db) {
  return queryAll(db, `
    SELECT
      model,
      COUNT(*) AS sessions,
      COALESCE(SUM(api_call_count), 0) AS api_calls,
      COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd
    FROM sessions
    WHERE model IS NOT NULL AND model != ''
    GROUP BY model
    ORDER BY sessions DESC
    LIMIT 20
  `)
}

function recentSessionQuery(db) {
  const session = queryAll(db, `
    SELECT id, title, model, started_at, ended_at, end_reason,
      input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
      reasoning_tokens, api_call_count, tool_call_count,
      estimated_cost_usd, actual_cost_usd, cost_status, cost_source
    FROM sessions
    WHERE id IS NOT NULL
    ORDER BY COALESCE(last_activity_at, started_at, 0) DESC
    LIMIT 1
  `)
  const row = session.rows && session.rows[0]
  if (!row) return { session: null, messages: [], tools: [] }
  const messages = queryAll(db, `
    SELECT role, tool_name, token_count, timestamp, finish_reason
    FROM messages
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `, row.id)
  const tools = queryAll(db, `
    SELECT tool_name, COUNT(*) AS calls, COALESCE(SUM(token_count), 0) AS tokens
    FROM messages
    WHERE session_id = ? AND tool_name IS NOT NULL AND tool_name != ''
    GROUP BY tool_name
    ORDER BY calls DESC
  `, row.id)
  return {
    session: row,
    messageCount: (messages.rows || []).length,
    messages: (messages.rows || []).slice(-60),
    tools: tools.rows || [],
  }
}

function sessionsQuery(db) {
  return queryAll(db, `
    SELECT id, title, model, started_at, ended_at, last_activity_at,
      input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
      reasoning_tokens, api_call_count, tool_call_count,
      estimated_cost_usd, cost_status, cost_source
    FROM sessions
    WHERE id IS NOT NULL
    ORDER BY COALESCE(last_activity_at, started_at, 0) DESC
    LIMIT 100
  `)
}

function apiUsageQuery(db, sessionId) {
  const table = queryAll(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'session_api_usage'")
  if (table.error || !table.rows?.length) return { rows: [], unavailable: true }
  const columns = queryAll(db, 'PRAGMA table_info("session_api_usage")')
  const available = new Set((columns.rows || []).map(row => row.name))
  const optional = ['tool_call_count', 'tool_names', 'assistant_content_chars', 'finish_reason', 'latency_ms']
  const selectOptional = optional.map(column => available.has(column) ? column : `NULL AS ${column}`).join(',\n      ')
  return queryAll(db, `
    SELECT request_id, session_id, model, billing_provider,
      input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
      reasoning_tokens, estimated_cost_usd, actual_cost_usd,
      cost_status, cost_source, started_at, completed_at, status,
      ${selectOptional}
    FROM session_api_usage
    WHERE session_id = ?
    ORDER BY completed_at ASC
    LIMIT 500
  `, sessionId)
}

export function createTrafficApi() {
  return {
    name: 'hermes-traffic-api',
    configureServer(server) {
      server.middlewares.use('/api/traffic', async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        const path = url.pathname.replace(/^\/api\/traffic/, '')

        if (path === '/capabilities') {
          return sendJson(res, discoverCapabilities())
        }

        if (path === '/capability-translations/status') {
          const caps = discoverCapabilities().capabilities
          return sendJson(res, getTranslationStatus(caps))
        }

        if (path === '/capability-translations' && req.method === 'GET') {
          return sendJson(res, { items: readTranslations() })
        }

        if (path === '/capability-translations/run' && req.method === 'POST') {
          try {
            const caps = discoverCapabilities().capabilities
            const result = await translatePending(caps)
            return sendJson(res, { ok: true, ...result, status: getTranslationStatus(caps) })
          } catch (error) {
            res.statusCode = 500
            return sendJson(res, { error: String(error?.message || error) })
          }
        }

        const db = openDb()
        if (!db) {
          res.statusCode = 500
          return sendJson(res, { error: 'state.db not found', path: DB_PATH })
        }
        if (db.error) {
          res.statusCode = 500
          return sendJson(res, { error: 'open failed', detail: db.error })
        }

        if (path === '/overview') {
          const result = {
            source: 'state.db',
            generatedAt: new Date().toISOString(),
            overview: overviewQuery(db),
            trend: trendQuery(db),
            models: modelsQuery(db),
          }
          db.close()
          return sendJson(res, result)
        }

        if (path === '/recent-session') {
          const result = {
            source: 'state.db',
            generatedAt: new Date().toISOString(),
            recent: recentSessionQuery(db),
          }
          db.close()
          return sendJson(res, result)
        }

        if (path === '/sessions') {
          const result = { source: 'state.db', generatedAt: new Date().toISOString(), sessions: sessionsQuery(db) }
          db.close()
          return sendJson(res, result)
        }

        if (path === '/session-usage') {
          const sessionId = url.searchParams.get('session_id')
          if (!sessionId) {
            db.close()
            res.statusCode = 400
            return sendJson(res, { error: 'session_id is required' })
          }
          const result = { source: 'state.db', generatedAt: new Date().toISOString(), usage: apiUsageQuery(db, sessionId) }
          db.close()
          return sendJson(res, result)
        }

        res.statusCode = 404
        return sendJson(res, { error: 'unknown endpoint', path })
      })
    },
  }
}
