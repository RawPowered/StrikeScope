import { useEffect, useRef } from 'react'
import $ from 'jquery'
import './formbuilder.css'
import { addressRenderTemplate } from './address-template'
import { getDropdownOptions } from './data'

interface Props {
  schemaJson: string
}

function getFieldValue(container: HTMLElement, fieldName: string): string {
  const el = container.querySelector<HTMLElement>(`[name="${fieldName}"]`)
  if (!el) return ''
  if (el.tagName === 'SELECT') return (el as HTMLSelectElement).value
  if (el.tagName === 'TEXTAREA') return (el as HTMLTextAreaElement).value
  if (el instanceof HTMLInputElement) {
    if (el.type === 'radio') {
      const checked = container.querySelector<HTMLInputElement>(`[name="${fieldName}"]:checked`)
      return checked?.value || ''
    }
    if (el.type === 'checkbox') {
      const checked = container.querySelectorAll<HTMLInputElement>(`[name="${fieldName}"]:checked`)
      return Array.from(checked).map(c => c.value).join(', ')
    }
    return el.value
  }
  return ''
}

function evalCondition(field: any, container: HTMLElement): boolean {
  const srcField = field.conditional_field
  const op = field.conditional_op
  const condVal = field.conditional_value
  if (!srcField || !op) return true

  const val = getFieldValue(container, srcField)

  switch (op) {
    case 'equals': return val === condVal
    case 'not_equals': return val !== condVal
    case 'contains': return val.toLowerCase().includes((condVal || '').toLowerCase())
    case 'not_contains': return !val.toLowerCase().includes((condVal || '').toLowerCase())
    case 'is_empty': return !val
    case 'is_not_empty': return !!val
    default: return true
  }
}

function applyConditionals(fields: any[], container: HTMLElement): void {
  const conditionalFields = fields.filter(f => f.conditional_field && f.conditional_op)
  if (!conditionalFields.length) return

  const showOrHide = () => {
    for (const f of conditionalFields) {
      const visible = evalCondition(f, container)
      const input = container.querySelector<HTMLElement>(`[name="${f.name}"]`)
      const formGroup = input?.closest('.form-group') as HTMLElement | null
      if (formGroup) {
        formGroup.style.display = visible ? '' : 'none'
      }
    }
  }

  showOrHide()

  const sourceNames = new Set(conditionalFields.map(f => f.conditional_field))
  for (const src of sourceNames) {
    const el = container.querySelector<HTMLElement>(`[name="${src}"]`)
    if (!el) continue
    el.addEventListener('change', showOrHide)
    el.addEventListener('input', showOrHide)
  }
}

function enhanceForm(fields: any[], container: HTMLElement): void {
  let lastEl: Element | null = null

  fields.forEach((field: any) => {
    const name = field.name
    if (!name) return

    const input = container.querySelector<HTMLElement>(`[name="${name}"]`)
    const formGroup = input?.closest('.form-group') as HTMLElement | null
    if (formGroup) lastEl = formGroup

    if (field.type === 'address') {
      const html = addressRenderTemplate(field)
      if (formGroup) {
        formGroup.outerHTML = html
      } else if (lastEl) {
        lastEl.insertAdjacentHTML('afterend', html)
      } else {
        container.insertAdjacentHTML('beforeend', html)
      }
      const rendered = container.querySelector<HTMLElement>(`[name="${name}"]`)
      if (rendered) lastEl = rendered.closest('.fb-address-render') || rendered
      return
    }

    if (!input) return

    if (field.hintText && formGroup) {
      const hint = document.createElement('small')
      hint.className = 'fb-hint text-gray-500 text-xs mt-1 block'
      hint.textContent = field.hintText
      formGroup.appendChild(hint)
    }

    if (field.defaultValue && input instanceof HTMLInputElement) {
      input.value = field.defaultValue
    }

    if (field.dropdownRef && input.tagName === 'SELECT') {
      const options = getDropdownOptions(field.dropdownRef)
      if (options.length) {
        const select = input as HTMLSelectElement
        select.innerHTML = '<option value="">Select...</option>'
        options.forEach(opt => {
          const option = document.createElement('option')
          option.value = opt.value
          option.textContent = opt.label
          select.appendChild(option)
        })
      }
    }
  })
}

export default function FormRenderWidget({ schemaJson }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || !schemaJson) return
    const parsed = (() => { try { return JSON.parse(schemaJson) } catch { return null } })()
    if (!parsed) return
    ;(async () => {
      ;(window as any).jQuery = $
      await import('formBuilder')
      if (!containerRef.current) return

      const processed = Array.isArray(parsed)
        ? parsed.map(f => f.type === 'address' ? { ...f, type: 'text', className: (f.className || '') + ' fb-addr-placeholder' } : f)
        : parsed

      $(containerRef.current).formRender({
        formData: processed,
        dataType: 'json',
        render: true,
      })

      const fieldArray = Array.isArray(parsed) ? parsed : parsed.length ? parsed : []
      enhanceForm(fieldArray, containerRef.current)
      applyConditionals(fieldArray, containerRef.current)
    })()
  }, [schemaJson])

  return <div ref={containerRef} />
}
