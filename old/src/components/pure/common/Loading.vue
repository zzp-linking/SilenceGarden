<template>
  <div class="loading" :class="{ 'loading-on': loading }">
    <div class="loader loader4">
      <div>
        <div>
          <div>
            <div>
              <div>
                <div>
                  <div>
                    <div>
                      <div>
                        <div></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
  export default {
    name: "Loading",
    props: [ 'loading' ]
  }
</script>

<style scoped lang="less">
  @import "../../../config/base.less";
  .loading.loading-on{
    pointer-events: auto;
    opacity: 1;
    transition: opacity 0s;
  }
  .loading{
    width: 100%;
    height: 100vh;
    position: fixed;
    overflow: hidden;
    top: 0;
    pointer-events: none;
    z-index: 100;
    line-height: 100vh;
    transition: opacity .3s;
    opacity: 0;
    background-color: #ffffff;
  }

  @-webkit-keyframes rotate {
    0% {
      -webkit-transform: rotate(0deg);
      transform: rotate(0deg);
    }
    50% {
      -webkit-transform: rotate(180deg);
      transform: rotate(180deg);
    }
    100% {
      -webkit-transform: rotate(360deg);
      transform: rotate(360deg);
    }
  }
  @keyframes rotate {
    0% {
      -webkit-transform: rotate(0deg);
      transform: rotate(0deg);
    }
    50% {
      -webkit-transform: rotate(180deg);
      transform: rotate(180deg);
    }
    100% {
      -webkit-transform: rotate(360deg);
      transform: rotate(360deg);
    }
  }
  @-webkit-keyframes rotate2 {
    0% {
      -webkit-transform: rotate(0deg);
      transform: rotate(0deg);
      border-top-color: rgba(0, 0, 0, 0.5);
    }
    50% {
      -webkit-transform: rotate(180deg);
      transform: rotate(180deg);
      border-top-color: rgba(255, 69, 0, 0.5);
    }
    100% {
      -webkit-transform: rotate(360deg);
      transform: rotate(360deg);
      border-top-color: rgba(0, 0, 0, 0.5);
    }
  }
  @keyframes rotate2 {
    0% {
      -webkit-transform: rotate(0deg);
      transform: rotate(0deg);
      border-top-color: rgba(0, 0, 0, 0.5);
    }
    50% {
      -webkit-transform: rotate(180deg);
      transform: rotate(180deg);
      border-top-color: rgba(255, 69, 0, 0.5);
    }
    100% {
      -webkit-transform: rotate(360deg);
      transform: rotate(360deg);
      border-top-color: rgba(0, 0, 0, 0.5);
    }
  }

  .loader {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    margin: auto auto;
    width: 150px;
    height: 150px;
    display: block;
    overflow: hidden;
  }
  .loader div {
    height: 100%;
  }

  /* loader 1 */
  .loader1, .loader1 div {
    border-radius: 50%;
    padding: 8px;
    border: 2px solid transparent;
    -webkit-animation: rotate linear 3.5s infinite;
    animation: rotate linear 3.5s infinite;
    border-top-color: rgba(0, 0, 0, 0.5);
    border-bottom-color: rgba(0, 0, 255, 0.5);
  }

  /*loader 2  */
  .loader2, .loader2 div {
    border-radius: 50%;
    padding: 8px;
    border: 2px solid transparent;
    -webkit-animation: rotate linear 3.5s infinite;
    animation: rotate linear 3.5s infinite;
    border-top-color: rgba(0, 0, 255, 0.5);
    border-left-color: rgba(0, 0, 0, 0.5);
    border-right-color: rgba(0, 0, 0, 0.5);
  }

  /*loader 3  */
  .loader3, .loader3 div {
    border-radius: 50%;
    padding: 8px;
    border: 2px solid transparent;
    -webkit-animation: rotate linear 3.5s infinite;
    animation: rotate linear 3.5s infinite;
    border-top-color: rgba(0, 0, 0, 0.5);
    border-left-color: rgba(0, 0, 255, 0.5);
    -webkit-animation-timing-function: cubic-bezier(0.55, 0.38, 0.21, 0.88);
    animation-timing-function: cubic-bezier(0.55, 0.38, 0.21, 0.88);
    -webkit-animation-duration: 3s;
    animation-duration: 3s;
  }

  /* loader 4 */
  .loader4, .loader4 div {
    border-radius: 50%;
    padding: 8px;
    border: 2px solid transparent;
    -webkit-animation: rotate linear 3.5s infinite;
    animation: rotate linear 3.5s infinite;
    border-radius: 50%;
    padding: 4px;
    -webkit-animation: rotate2 4s infinite linear;
    animation: rotate2 4s infinite linear;
  }

  div:hover {
    -webkit-animation-play-state: paused;
    animation-play-state: paused;
  }

  .loader, .loader * {
    will-change: transform;
  }

  @media only screen and (max-width: @threshold) {
    .loader4, .loader4 div{
      border: 1px solid transparent;
      padding: 4px;
    }
  }
</style>
