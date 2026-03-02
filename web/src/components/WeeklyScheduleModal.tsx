import { useLang } from '../contexts/LangContext'
import { useWeeklySchedule } from '../contexts/WeeklyScheduleContext'

const DAY_NAMES_ZH = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const DAY_NAMES_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function WeeklyScheduleModal({ onClose }: { onClose: () => void }) {
  const { lang } = useLang()
  const { schedule, setDay } = useWeeklySchedule()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-[#2D2D2D]">
            {lang === 'zh' ? '每周用餐时间' : 'Weekly meal times'}
          </h3>
          <button type="button" onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <p className="text-sm text-stone-500 mb-6">
          {lang === 'zh' ? '设置每周各天的早/午/晚餐时间，系统将据此推荐与提醒。' : 'Set default meal times per weekday for recommendations and reminders.'}
        </p>
        <div className="space-y-4">
          {(lang === 'zh' ? DAY_NAMES_ZH : DAY_NAMES_EN).map((label, i) => {
            const d = schedule[i] ?? { breakfast_time: '08:00', lunch_time: '13:00', dinner_time: '19:30' }
            return (
              <div key={i} className="flex flex-wrap items-center gap-4 py-3 border-b border-stone-100 last:border-0">
                <span className="w-16 text-sm font-medium text-stone-700">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-stone-400 uppercase w-16">{lang === 'zh' ? '早' : 'B'}</span>
                  <input
                    type="time"
                    value={d.breakfast_time}
                    onChange={(e) => setDay(i, { breakfast_time: e.target.value })}
                    className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-stone-400 uppercase w-16">{lang === 'zh' ? '午' : 'L'}</span>
                  <input
                    type="time"
                    value={d.lunch_time}
                    onChange={(e) => setDay(i, { lunch_time: e.target.value })}
                    className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-stone-400 uppercase w-16">{lang === 'zh' ? '晚' : 'D'}</span>
                  <input
                    type="time"
                    value={d.dinner_time}
                    onChange={(e) => setDay(i, { dinner_time: e.target.value })}
                    className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-8 flex justify-end">
          <button type="button" onClick={onClose} className="px-6 py-2.5 bg-[#2D2D2D] text-white rounded-lg text-sm font-medium hover:bg-[#C66B49]">
            {lang === 'zh' ? '完成' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  )
}
