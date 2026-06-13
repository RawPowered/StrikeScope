import { useEffect, useRef } from 'react'
import $ from 'jquery'
import './formbuilder.css'
import { addressTemplate } from './address-template'
import { getDropdownRefs } from './data'

interface Props {
  initialData?: string
  onSave: (json: string) => void
}

const CONDITIONAL_OPS = [
  ['equals', 'Equals'],
  ['not_equals', 'Not equals'],
  ['contains', 'Contains'],
  ['not_contains', 'Not contains'],
  ['is_empty', 'Is empty'],
  ['is_not_empty', 'Is not empty'],
]

const TYPE_USER_ATTRS: Record<string, any> = {
  '*': {
    hintText: { label: 'Hint Text', value: '' },
    defaultValue: { label: 'Default Value', value: '' },
    conditional_field: { label: 'Show/hide based on field', value: '' },
    conditional_op: {
      label: 'Condition',
      type: 'select',
      options: Object.fromEntries(CONDITIONAL_OPS),
      value: '',
    },
    conditional_value: { label: 'Condition value', value: '' },
  },
  select: {
    dropdownRef: {
      label: 'Dropdown Data',
      type: 'select',
      options: Object.fromEntries([
        ['', 'None'],
        ...getDropdownRefs().map(r => [r, r]),
      ]),
      value: '',
    },
  },
  autocomplete: {
    dropdownRef: {
      label: 'Dropdown Data',
      type: 'select',
      options: Object.fromEntries([
        ['', 'None'],
        ...getDropdownRefs().map(r => [r, r]),
      ]),
      value: '',
    },
  },
  address: {
    _addr_enabled: {
      label: 'Enabled Sub-fields',
      type: 'checkbox_group',
      options: {
        street: 'Street Address',
        street2: 'Street Address Line 2',
        city: 'City',
        state: 'State',
        zip: 'Zip Code',
        country: 'Country',
      },
      value: ['street', 'city', 'state', 'zip'],
    },
    _addr_default_street: { label: 'Street Default', value: '' },
    _addr_default_street2: { label: 'Street 2 Default', value: '' },
    _addr_default_city: { label: 'City Default', value: '' },
    _addr_default_state: { label: 'State Default', value: '' },
    _addr_default_zip: { label: 'Zip Default', value: '' },
    _addr_default_country: { label: 'Country Default', value: '' },
  },
}

export default function FormBuilderWidget({ initialData, onSave }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fbRef = useRef<any>(null)

  useEffect(() => {
    (async () => {
      ;(window as any).jQuery = $
      await import('jquery-ui/ui/version')
      await import('jquery-ui/ui/widget')
      await import('jquery-ui/ui/data')
      await import('jquery-ui/ui/scroll-parent')
      await import('jquery-ui/ui/widgets/mouse')
      await import('jquery-ui/ui/widgets/sortable')
      await import('formBuilder')
      if (!containerRef.current) return
      const parsed = initialData ? (() => { try { return JSON.parse(initialData) } catch { return null } })() : null
      const fb = $(containerRef.current).formBuilder({
        formData: parsed,
        showActionButtons: false,
        typeUserAttrs: TYPE_USER_ATTRS,
        fields: [
          {
            type: 'address',
            label: 'Address',
            icon: '📍',
            template: addressTemplate,
          },
        ],
        i18n: {
          address: {
            label: 'Address',
            icon: '📍',
          },
        },
        controlOrder: [
          'text', 'textarea', 'number', 'select', 'checkbox-group',
          'radio-group', 'date', 'file', 'autocomplete', 'address',
          'hidden', 'paragraph', 'header', 'button',
        ],
        disabledAttrs: [
          'subtype',
        ],
        disableHTMLLabels: true,
      })
      fbRef.current = fb
    })()
    return () => {
      try { fbRef.current?.actions?.clearFields?.() } catch {}
    }
  }, [])

  const handleSave = () => {
    if (!fbRef.current) return
    const data = fbRef.current.actions?.getData?.('json', true)
    if (data) onSave(typeof data === 'string' ? data : JSON.stringify(data))
  }

  return (
    <div>
      <div ref={containerRef} className="fb-wrap" />
      <div className="mt-4 flex justify-end gap-2 border-t pt-4">
        <button
          onClick={handleSave}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Save Form
        </button>
      </div>
    </div>
  )
}
