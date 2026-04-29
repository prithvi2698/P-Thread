export interface Product {
  id: string;
  name: string;
  price?: number;
  originalPrice?: number;
  description: string;
  image: string;
  category: 'Essentials' | 'Graphic' | 'Limited';
  sizes: string[];
  colors: { name: string; hex: string; imageIndex?: number }[];
  isNew?: boolean;
  video?: string;
  images?: string[];
  stock?: number;
}

export interface CartItem extends Product {
  quantity: number;
  selectedSize: string;
  selectedColor: string;
}
