import React from 'react';

export default function HeroSection() {
  return (
    <section className="bg-brand-light-gold">
      <div className="container mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-brand-dark leading-tight mb-4">
          Encontre o Projeto dos Seus Sonhos
        </h1>
        <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
          Projetos de arquitetura completos para construir, com a qualidade e o suporte que você merece.
        </p>
      </div>
    </section>
  );
}
