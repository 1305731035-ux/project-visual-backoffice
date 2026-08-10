import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createTrafficApi } from './server/trafficApi.js'
import { createProjectFilesApi } from './server/projectFilesApi.js'
import { createGitApi } from './server/gitApi.js'
import { createProjectSkillsApi } from './server/projectSkillsApi.js'

export default defineConfig({
  plugins: [react(), createTrafficApi(), createProjectFilesApi(), createGitApi(), createProjectSkillsApi()],
})
