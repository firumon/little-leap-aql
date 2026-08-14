import { differenceInCalendarDays } from 'date-fns'
import VisitActionButtons from './VisitActionButtons.vue'
import { sortByDate } from 'src/utils/sortHelpers'

/**
 * OutletVisits › "Overdue" view — planned visits whose date has already passed.
 *
 * Row actions stay live here: an overdue visit is still actionable, so the
 * Cancel/Postpone/Complete cluster is mounted through `btn`.
 */
export default function (props) {
  return {
    // Oldest first — the most overdue visit is the most urgent.
    items: sortByDate(props.items, 'Date', 'asc'),
    layout: ['caption', 'label', 'caption'],
    content: [
      (ov) => ov.Date,
      (ov) => ov.$outlet?.Name || ov.OutletCode,
      (ov) => ov.ProgressPlannedComment
    ],
    metaLayout: ['chip'],
    chip: (ov) => `${differenceInCalendarDays(new Date(), new Date(ov.Date))} Days`,
    chipColor: (ov) => (differenceInCalendarDays(new Date(), new Date(ov.Date)) >= 7 ? 'negative' : 'warning'),
    btn: VisitActionButtons
  }
}
