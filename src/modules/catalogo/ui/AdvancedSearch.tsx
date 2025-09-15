import React from 'react';

type Props = {
  filters: Record<string, any>;
  onFilterChange: (next: Record<string, any>) => void;
  onClear: () => void;
};

export default function AdvancedSearch({ filters, onFilterChange, onClear }: Props) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onFilterChange({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg container mx-auto max-w-5xl z-10 relative mb-10 fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Estilo</label>
          <select
            name="style"
            value={filters.style || ''}
            onChange={handleInputChange}
            className="w-full p-2 border border-slate-200 rounded-md focus:ring-brand-gold focus:border-brand-gold"
          >
            <option value="">Todos</option>
            <option value="Térreo">Térreo</option>
            <option value="Sobrado">Sobrado</option>
            <option value="Campo">Casa de Campo</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Área Construída</label>
          <select
            name="area"
            value={filters.area || ''}
            onChange={handleInputChange}
            className="w-full p-2 border border-slate-200 rounded-md focus:ring-brand-gold focus:border-brand-gold"
          >
            <option value="">Qualquer</option>
            <option value="150">Até 150 m²</option>
            <option value="250">150 a 250 m²</option>
            <option value="251">Acima de 250 m²</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Quartos (mín)</label>
          <select
            name="bedrooms"
            value={filters.bedrooms || ''}
            onChange={handleInputChange}
            className="w-full p-2 border border-slate-200 rounded-md focus:ring-brand-gold focus:border-brand-gold"
          >
            <option value="">Todos</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Banheiros (mín)</label>
          <select
            name="bathrooms"
            value={filters.bathrooms || ''}
            onChange={handleInputChange}
            className="w-full p-2 border border-slate-200 rounded-md focus:ring-brand-gold focus:border-brand-gold"
          >
            <option value="">Todos</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Largura Terreno (mín)</label>
          <input
            type="number"
            name="terrain_width"
            value={filters.terrain_width || ''}
            onChange={handleInputChange}
            className="w-full p-2 border border-slate-200 rounded-md focus:ring-brand-gold focus:border-brand-gold"
            placeholder="Ex: 10"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Comp. Terreno (mín)</label>
          <input
            type="number"
            name="terrain_length"
            value={filters.terrain_length || ''}
            onChange={handleInputChange}
            className="w-full p-2 border border-slate-200 rounded-md focus:ring-brand-gold focus:border-brand-gold"
            placeholder="Ex: 25"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Características</label>
          <select
            name="features"
            value={filters.features || ''}
            onChange={handleInputChange}
            className="w-full p-2 border border-slate-200 rounded-md focus:ring-brand-gold focus:border-brand-gold"
          >
            <option value="">Todas</option>
            <option value="Piscina">Com Piscina</option>
            <option value="Área Gourmet">Com Área Gourmet</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={onClear}
            className="w-full text-sm hover:text-brand-gold text-slate-600 font-semibold bg-slate-100 hover:bg-slate-200 py-2 rounded-md"
          >
            Limpar Filtros
          </button>
        </div>
      </div>
    </div>
  );
}
