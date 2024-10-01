const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    webSocketServer: false,	 
    proxy: {
        '/api': {
            target: 'http://192.168.14.137:8082',
            // 允许跨域
            changeOrigin: true,
            pathRewrite: {
                '^/api': '/'
            }
        },
	    
        '/ws': {
          target: 'http://192.168.14.137:8082',
          //vue cli3默认值为true，请求后台时host会被target配置覆盖，false则为原始值
	  changeOrigin: false,
          ws: true,
          pathRewrite: {
            '^/ws': '/'
          }
       }
    }
}
})

