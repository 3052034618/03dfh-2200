export default defineAppConfig({
  pages: [
    'pages/inspection/index',
    'pages/matching/index',
    'pages/review/index',
    'pages/inspection-detail/index',
    'pages/inspection-result/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#1E88E5',
    navigationBarTitleText: '冷链温控检查',
    navigationBarTextStyle: 'white',
    backgroundColor: '#F5F7FA'
  },
  tabBar: {
    color: '#86909C',
    selectedColor: '#1E88E5',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/inspection/index',
        text: '出车检查'
      },
      {
        pagePath: 'pages/matching/index',
        text: '温区匹配'
      },
      {
        pagePath: 'pages/review/index',
        text: '抽查管理'
      }
    ]
  }
})
