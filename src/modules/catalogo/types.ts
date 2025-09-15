// src/modules/catalogo/types.ts

export type Addon = {
  id: string;
  label: string;      // rótulo exibido (ex.: "Projeto Elétrico")
  price: number;      // preço do adicional (R$)
};

export type ProjectBase = {
  title: string;
  price: number;
  area: number;
  bedrooms: number;
  bathrooms: number;
  lotWidth: number;
  lotLength: number;
  tags: string[];
  description?: string;

  // lista de adicionais (opcional)
  addons?: Addon[];

  // imagens soltas
  mainImageUrl?: string;
  galleryUrls?: string[];

  // estrutura nomeada opcional (para rótulos das abas da galeria)
  images?: { label?: string; url: string }[];
};

export type ProjectDoc = ProjectBase & {
  id: string;
  createdAt?: unknown;  // Timestamp do Firestore
};
