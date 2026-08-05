import { differenceInCalendarDays } from 'date-fns'
import VisitActionButtons from './VisitActionButtons.vue'

export default function(props,ctx){
  return {
    layout: ['caption','label','caption'],
    content: [
      (ov) => ov.Date,
      (ov) => ov.$outlet.Name,
      (ov) => ov.ProgressPlannedComment
    ],
    metaLayout: ['chip'],
    chip: (ov) => `${differenceInCalendarDays(new Date(), new Date(ov.Date))} Days`,
    chipColor: (ov) => differenceInCalendarDays(new Date(), new Date(ov.Date)) >= 7 ? 'negative' : 'warning',
    btn: VisitActionButtons,
  }
}
