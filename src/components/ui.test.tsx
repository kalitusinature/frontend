import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatusPill } from './ui'
import { reservationStatusLabels } from '../utils'

describe('reservation status display', () => {
  it('renders checked-in reservations with the staff-facing label and style', () => {
    const markup = renderToStaticMarkup(
      <StatusPill
        status="checked_in"
        label={reservationStatusLabels.checked_in}
      />,
    )

    expect(markup).toContain('class="status-pill status-checked-in"')
    expect(markup).toContain('>Checked In</span>')
  })
})
