/** 单餐展示用（今日餐单 / 计划页） */
export interface MealItem {
  id?: string
  /** 用餐时间 "HH:mm" */
  mealTime: string
  nameEn: string
  nameZh: string
  /** 简短描述 */
  descEn: string
  descZh: string
  /** 用到的食材，展示用 */
  usingEn: string
  usingZh: string
  /** 是否优先用库存 */
  urgent: boolean
  stepsEn: string
  stepsZh: string
  /** 系统估计做饭时长（分钟） */
  cookDurationMins: number
  /** 食谱 ID，对接后端用 */
  recipeId?: string
}
