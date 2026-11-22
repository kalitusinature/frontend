import { useState, type FormEvent } from 'react'
import { ApiError, api } from '../api'
import type { PaymentMethod } from '../types'
import { formatUGX } from '../utils'
import { FormActions, FormField, Modal } from './ui'

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card_at_counter', label: 'Card at counter' },
  { value: 'mobile_money', label: 'Mobile money' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
]

export function RecordPaymentModal({
  token,
  orderId,
  reservationId,
  reference,
  totalDue,
  amountPaid,
  balance,
  customerEmail,
  notify,
  onClose,
  onSaved,
}: {
  token: string
  orderId?: number
  reservationId?: number
  reference: string
  totalDue: number
  amountPaid: number
  balance: number
  customerEmail: string
  notify: (message: string) => void
  onClose: () => void
  onSaved: () => void
}) {
  const [amount, setAmount] = useState(String(balance))
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [transactionReference, setTransactionReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amountUGX = Number(amount)
    if (!Number.isSafeInteger(amountUGX) || amountUGX < 1) {
      setError('Enter a valid payment amount in whole UGX.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payment = await api.recordPayment(token, {
        ...(orderId ? { order_id: orderId } : {}),
        ...(reservationId ? { reservation_id: reservationId } : {}),
        amount_ugx: amountUGX,
        method,
        transaction_reference: transactionReference.trim(),
      })
      if (payment.email_sent) {
        notify(`Payment verified. Receipt ${payment.receipt_number} was emailed.`)
      } else if (!payment.email_available) {
        notify('Payment verified. No customer email is on file; the receipt is saved for download.')
      } else {
        notify('Payment verified, but receipt email delivery failed. Retry it from Payment Receipts.')
      }
      onSaved()
      onClose()
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : requestError instanceof Error
            ? requestError.message
            : 'Could not record this payment.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Record payment · ${reference}`}
      subtitle="Confirm a payment received by resort staff. Each verified payment creates a receipt."
      onClose={() => {
        if (!saving) onClose()
      }}
    >
      <form className="editor-form" onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <FormField label="Total due">
            <strong>{formatUGX(totalDue)}</strong>
          </FormField>
          <FormField label="Paid to date">
            <strong>{formatUGX(amountPaid)}</strong>
          </FormField>
        </div>
        <FormField label="Outstanding balance">
          <strong>{formatUGX(balance)}</strong>
        </FormField>
        <FormField label="Payment amount (UGX)">
          <input
            autoFocus
            type="number"
            min="1"
            max={balance}
            step="1"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </FormField>
        <FormField label="Payment method">
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
          >
            {paymentMethods.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Transaction / counter receipt reference">
          <input
            required
            maxLength={120}
            value={transactionReference}
            onChange={(event) => setTransactionReference(event.target.value)}
            placeholder="e.g. POS-2048 or mobile-money reference"
          />
        </FormField>
        <p className="form-hint">
          The reference must be unique. A duplicate reference is rejected to prevent a duplicate receipt.
          {customerEmail ? ` The PDF will be emailed to ${customerEmail}.` : ' No customer email is on file.'}
        </p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <FormActions
          onCancel={onClose}
          saving={saving}
          submitLabel="Verify payment and issue receipt"
        />
      </form>
    </Modal>
  )
}
