import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PanelHeader from '../PanelHeader.vue'

describe('PanelHeader', () => {
  it('renders the label text', () => {
    const wrapper = mount(PanelHeader, { props: { label: 'Graph' } })
    expect(wrapper.find('[data-test="panel-label"]').text()).toBe('Graph')
  })

  it('renders the expand button with correct aria-label when not expanded', () => {
    const wrapper = mount(PanelHeader, { props: { label: 'Graph', isExpanded: false } })
    const btn = wrapper.find('[data-test="expand-btn"]')
    expect(btn.attributes('aria-label')).toBe('Expand graph panel')
  })

  it('renders the expand button with "Exit full page" aria-label when expanded', () => {
    const wrapper = mount(PanelHeader, { props: { label: 'Graph', isExpanded: true } })
    const btn = wrapper.find('[data-test="expand-btn"]')
    expect(btn.attributes('aria-label')).toBe('Exit graph full page')
  })

  it('emits "toggle" when the expand button is clicked', async () => {
    const wrapper = mount(PanelHeader, { props: { label: 'Graph' } })
    await wrapper.find('[data-test="expand-btn"]').trigger('click')
    expect(wrapper.emitted('toggle')).toBeTruthy()
    expect(wrapper.emitted('toggle').length).toBe(1)
  })

  it('shows an expand SVG icon when not expanded', () => {
    const wrapper = mount(PanelHeader, { props: { label: 'Graph', isExpanded: false } })
    expect(wrapper.find('[data-test="icon-expand"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="icon-exit"]').exists()).toBe(false)
  })

  it('shows an exit SVG icon when expanded', () => {
    const wrapper = mount(PanelHeader, { props: { label: 'Graph', isExpanded: true } })
    expect(wrapper.find('[data-test="icon-expand"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="icon-exit"]').exists()).toBe(true)
  })

  it('label prop for "File Viewer" produces correct aria-label', () => {
    const wrapper = mount(PanelHeader, { props: { label: 'File Viewer', isExpanded: false } })
    const btn = wrapper.find('[data-test="expand-btn"]')
    expect(btn.attributes('aria-label')).toBe('Expand file viewer panel')
  })
})
