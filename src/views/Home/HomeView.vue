<template>
  <main class="home-view">
    <section class="top-home-page" id="top-home-page">
      <div class="hero-content">
        <h1 class="nom">
          <AsciiDecoder text="Lukas Bouzom" />
        </h1>
        <p class="portfolio-text">Portfolio</p>
      </div>
      <AsciiGrass class="bottom-grass" />
    </section>

    <section class="home-content" id="home-content">
      <div class="container">
        <h2 class="section-title">Projets</h2>
      </div>
    </section>
  </main>
</template>

<script lang="ts" src="./HomeView.ts"></script>
<style lang="scss" scoped src="./HomeView.scss"></style>
