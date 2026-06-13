interface JQuery {
  formBuilder(options?: any): any
  formRender(options?: any): any
  formBuilder(method: string, ...args: any[]): any
  formRender(method: string, ...args: any[]): any
}

declare module 'jquery-ui/ui/version' {}
declare module 'jquery-ui/ui/widget' {}
declare module 'jquery-ui/ui/data' {}
declare module 'jquery-ui/ui/scroll-parent' {}
declare module 'jquery-ui/ui/widgets/mouse' {}
declare module 'jquery-ui/ui/widgets/sortable' {}
declare module 'formBuilder' {}

interface AddressFieldData {
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
  dropdownRef?: string
  conditionRules?: string
}
