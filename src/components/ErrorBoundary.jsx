import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Page error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-10 text-center">
          <div className="text-4xl">⚠️</div>
          <div className="text-base font-bold text-text">حدث خطأ غير متوقع في هذه الصفحة</div>
          <div className="max-w-md text-sm text-muted">{String(this.state.error.message || this.state.error)}</div>
          <button
            onClick={() => this.setState({ error: null })}
            className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-bg hover:opacity-90"
          >
            إعادة المحاولة
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
