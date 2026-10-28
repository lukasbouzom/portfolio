import { defineComponent, ref, onMounted, onUnmounted } from 'vue'

export default defineComponent({
  name: 'AsciiDecoder',
  props: {
    text: {
      type: String,
      required: true
    },
    scrambleSpeed: {
      type: Number,
      default: 30
    }
  },
  setup(props) {
    const displayText = ref('')
    const CHARS = '!<>-_\\/[]{}—=+*^?#________0123456789'
    let frame = 0
    let intervalId: number | null = null
    let isAnimating = false

    function randomChar(): string {
      return CHARS[Math.floor(Math.random() * CHARS.length)]
    }

    function scramble() {
      if (isAnimating) return
      isAnimating = true
      frame = 0

      const target = props.text
      const length = target.length
      const stepsPerChar = 3

      if (intervalId !== null) {
        clearInterval(intervalId)
      }

      intervalId = window.setInterval(() => {
        let output = ''
        let complete = 0

        for (let i = 0; i < length; i++) {
          if (target[i] === ' ') {
            output += ' '
            complete++
            continue
          }

          const startResolveFrame = i * stepsPerChar
          if (frame >= startResolveFrame + 6) {
            output += target[i]
            complete++
          } else if (frame >= startResolveFrame) {
            output += randomChar()
          } else {
            output += randomChar()
          }
        }

        displayText.value = output
        frame++

        if (complete === length) {
          if (intervalId !== null) {
            clearInterval(intervalId)
            intervalId = null
          }
          displayText.value = target
          isAnimating = false
        }
      }, props.scrambleSpeed)
    }

    onMounted(() => {
      scramble()
    })

    onUnmounted(() => {
      if (intervalId !== null) {
        clearInterval(intervalId)
      }
    })

    return {
      displayText
    }
  }
})
