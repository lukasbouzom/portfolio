import { defineComponent } from 'vue'
import AsciiGrass from '@/components/home/AsciiGrass/AsciiGrass.vue'
import AsciiDecoder from '@/components/common/AsciiDecoder/AsciiDecoder.vue'

export default defineComponent({
  name: 'HomeView',
  components: {
    AsciiGrass,
    AsciiDecoder
  }
})
