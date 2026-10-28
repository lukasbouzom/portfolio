import { defineComponent } from 'vue'
import { RouterView } from 'vue-router'
import TopBar from '@/components/layout/TopBar/TopBar.vue'

export default defineComponent({
  name: 'App',
  components: {
    TopBar,
    RouterView
  }
})
