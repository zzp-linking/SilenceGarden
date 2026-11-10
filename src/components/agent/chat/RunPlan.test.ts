import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import type { AgentPlan } from '@/features/agent/chat/model'
import RunPlan from './RunPlan.vue'

/** 计划折叠时汇总实际完成数，展开后区分尚未执行、失败和真实完成。 */
it('只在有已确认计划时显示折叠步骤', async () => {
  const wrapper = mount(RunPlan)
  try {
    expect(wrapper.find('details').exists()).toBe(false)
    const plan: AgentPlan = { plan_version: 4, steps: [
      { step_id: 1, kind: 'export', status: 'completed' },
      { step_id: 2, kind: 'download', status: 'failed' },
      { step_id: 3, kind: 'answer', status: 'pending' }
    ] }
    await wrapper.setProps({ plan })
    expect(wrapper.get('summary').text()).toBe('执行步骤（1/3 完成）')
    expect(wrapper.get('details').attributes()).not.toHaveProperty('open')
    expect(wrapper.findAll('li').map(item => item.findAll('span').map(span => span.text()))).toEqual([
      ['导出文件', '已完成'], ['下载文件', '失败'], ['整理回答', '待执行']
    ])
  } finally {
    wrapper.unmount()
  }
})
