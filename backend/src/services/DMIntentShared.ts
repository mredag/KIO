export function normalizeTurkish(text: string): string {
  return text
    .replace(/ü/g, 'u').replace(/Ü/g, 'u')
    .replace(/ö/g, 'o').replace(/Ö/g, 'o')
    .replace(/ş/g, 's').replace(/Ş/g, 's')
    .replace(/ç/g, 'c').replace(/Ç/g, 'c')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'g')
    .replace(/ı/g, 'i').replace(/İ/g, 'i');
}

export const KEYWORD_CATEGORY_MAP: Record<string, string[]> = {
  services: ['masaj', 'massage', 'spa', 'hamam', 'sauna', 'buhar', 'fitness',
             'pilates', 'reformer', 'yuzme', 'havuz', 'taekwondo', 'jimnastik',
             'kickboks', 'boks', 'pt', 'personal', 'trainer', 'kurs', 'ders',
             'hizmet', 'servis', 'uyelik', 'membership'],
  pricing: ['fiyat', 'ucret', 'para', 'tl', 'lira', 'kampanya', 'indirim',
            'paket', 'aylik', 'yillik', 'ne kadar', 'kac lira', 'kac tl',
            'price', 'cost'],
  hours: ['saat', 'acik', 'kapali', 'calisma', 'program', 'gun', 'hafta',
          'pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi',
          'pazar', 'kacta', 'kaca kadar', 'ne zaman', 'schedule'],
  policies: ['iptal', 'kural', 'yas', 'cocuk', 'ceza', 'politika', 'odeme',
             'nakit', 'kredi', 'kart', 'taksit', 'havlu', 'sort', 'bone',
             'getir', 'yaninda'],
  contact: ['adres', 'nerede', 'konum', 'harita', 'telefon', 'numara',
            'ara', 'iletisim', 'ulasim', 'yol', 'tarif', 'maps', 'address',
            'neredesiniz', 'neresindesiniz'],
  faq: ['randevu', 'rezervasyon', 'nasil', 'terapist', 'kadin', 'erkek',
        'sicaklik', 'derece', 'havuz sicak', 'pt var mi', 'ne getir'],
};

export const MASSAGE_DETAIL_KEYWORDS = [
  'klasik',
  'medikal',
  'mix',
  'aromaterapi',
  'derin doku',
  'sicak tas',
  'kopuk',
  'kese',
];
