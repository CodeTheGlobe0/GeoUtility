import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'
import dashboardLayoutPlugin from './vite-plugins/dashboardLayoutPlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cesium(), dashboardLayoutPlugin()],
})
