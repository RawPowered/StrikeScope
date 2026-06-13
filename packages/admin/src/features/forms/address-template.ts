export interface AddressFieldData {
  label?: string
  name?: string
  required?: boolean
  _addr_enabled?: string[]
  _addr_default_street?: string
  _addr_default_street2?: string
  _addr_default_city?: string
  _addr_default_state?: string
  _addr_default_zip?: string
  _addr_default_country?: string
  hintText?: string
  defaultValue?: string
}

const SUBFIELD_LABELS: Record<string, string> = {
  street: 'Street Address',
  street2: 'Street Address Line 2',
  city: 'City',
  state: 'State',
  zip: 'Zip Code',
  country: 'Country',
}

function getEnabledSubfields(fieldData?: AddressFieldData): string[] {
  return fieldData?._addr_enabled?.length ? fieldData._addr_enabled : ['street', 'city', 'state', 'zip']
}

function getDefault(fieldData: AddressFieldData | undefined, key: string): string {
  const map: Record<string, string | undefined> = {
    street: fieldData?._addr_default_street,
    street2: fieldData?._addr_default_street2,
    city: fieldData?._addr_default_city,
    state: fieldData?._addr_default_state,
    zip: fieldData?._addr_default_zip,
    country: fieldData?._addr_default_country,
  }
  return map[key] ?? ''
}

export function addressTemplate(fieldData: any): string {
  const enabled = getEnabledSubfields(fieldData as AddressFieldData)
  const rows = enabled.map(key => `
    <div class="fb-addr-row">
      <label class="fb-addr-label">${SUBFIELD_LABELS[key] || key}</label>
      <input type="text" class="form-control fb-addr-input" placeholder="${SUBFIELD_LABELS[key] || key}" disabled />
    </div>
  `).join('')
  return `<div class="fb-address-wrap" data-field-type="address">${rows}</div>`
}

export function addressRenderTemplate(fieldData: any): string {
  const addr = fieldData as AddressFieldData
  const enabled = getEnabledSubfields(addr)
  const rows = enabled.map(key => {
    const def = getDefault(addr, key)
    return `
      <div class="form-group fb-addr-row">
        <label class="fb-addr-label">${SUBFIELD_LABELS[key] || key}${addr?.required ? ' <span class="required">*</span>' : ''}</label>
        <input type="text" class="form-control fb-addr-input" name="${addr?.name || 'address'}[${key}]" placeholder="${SUBFIELD_LABELS[key] || key}" value="${def}" ${addr?.required ? 'required' : ''} />
      </div>
    `
  }).join('')
  return `<div class="fb-address-render" data-name="${addr?.name || 'address'}">${rows}</div>`
}
