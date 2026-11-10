window.__ModuleLoader__.load({
  id: '@junhao/harness-web',
  factory(require) {
    const { createElement } = require('react')

    function BrandMark({ size, className }) {
      return createElement('img', {
        src: './junhao/mark.svg', width: size, height: size, className, alt: '',
        'data-junhao-mark': '',
      })
    }

    function BrandName() {
      return createElement('span', { style: { fontWeight: 650, whiteSpace: 'nowrap' } }, 'Junhao Harness')
    }

    function apply(ctx) {
      // The published Web bundle sets its build title when the layout mounts.
      // Replace that suffix while retaining the selected session title.
      ctx.effect(() => {
        const upstreamTitle = 'DeepSeek Harness'
        const updateTitle = () => {
          if (document.title === upstreamTitle || document.title.endsWith(' — ' + upstreamTitle)) {
            document.title = document.title.slice(0, -upstreamTitle.length) + 'Junhao Harness'
          }
        }
        const observer = new MutationObserver(updateTitle)
        observer.observe(document.querySelector('title'), { childList: true, characterData: true, subtree: true })
        updateTitle()
        return () => observer.disconnect()
      })
      for (const [namespace, entries] of Object.entries(globalThis.__JUNHAO_DICTIONARIES__)) {
        ctx.effect(() => ctx.locale.register(namespace, 'zh-Hant', entries))
      }
      ctx.effect(() => ctx.locale.addLanguage({ id: 'zh-Hant', label: '繁體中文', fallback: 'zh' }))

      for (const [name, component] of [
        ['sidebar.brand.mark', BrandMark],
        ['sidebar.brand.name', BrandName],
        ['conversation.hero.brand.mark', BrandMark],
      ]) {
        ctx.slots.inject(name, () => ctx.slots.register({ name }, component))
      }
    }

    return { inject: ['locale', 'slots'], apply }
  },
})
