declare module 'mavon-editor' {
  import type { Component } from 'vue'

  export interface MavonEditorInstance {
    $img2Url(fileIndex: string | number, url: string): void
  }

  export const mavonEditor: Component
}
