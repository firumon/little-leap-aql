import { leadName, leadPlace } from './leadCard'

export default function (props) {
  return {
    ...props,
    layout: ['label', 'caption'],
    label: leadName,
    caption: leadPlace
  }
}
