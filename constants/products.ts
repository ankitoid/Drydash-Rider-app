export type ProductItem = {
  label: string;
  Price: number;
  viewPrice: string;
  newQtyPrice: number;
  img: string;
  type: "laundry" | "dryclean" | "shoespa";
};

export type ProductCategory = {
  label: string;
  children: ProductItem[];
};

export const PRODUCTS: Record<"laundry" | "dryclean" | "shoespa", ProductCategory> =
{
  /* ===================== LAUNDRY ===================== */
  laundry: {
    label: "Laundry",
    children: [
      {
        label: "W & F (Wearables)",
        viewPrice: "80/kg",
        Price: 80,
        newQtyPrice: 80,
        img: "w_f_wearable.jpg",
        type: "laundry",
      },
      {
        label: "W & F (Non-Wearables)",
        viewPrice: "100/kg",
        Price: 100,
        newQtyPrice: 100,
        img: "w_f_non-wearable.jpg",
        type: "laundry",
      },
      {
        label: "W & I (Wearables)",
        viewPrice: "100/kg",
        Price: 100,
        newQtyPrice: 100,
        img: "w_i_wearable.jpg",
        type: "laundry",
      },
      {
        label: "W & I (Non-Wearables)",
        viewPrice: "120/kg",
        Price: 120,
        newQtyPrice: 120,
        img: "w_i_non-wearable.jpg",
        type: "laundry",
      },
    ],
  },

  /* ===================== DRY CLEAN ===================== */
  dryclean: {
    label: "DryClean",
    children: [
      { label: "Shirt / T-Shirt", Price: 100, viewPrice: "100/pc", newQtyPrice: 100, img: "shirt.png", type: "dryclean" },
      { label: "Jeans", Price: 120, viewPrice: "120/pc", newQtyPrice: 120, img: "jeans.png", type: "dryclean" },
      { label: "Trousers", Price: 100, viewPrice: "100/pc", newQtyPrice: 100, img: "trouser.png", type: "dryclean" },
      { label: "Blazer / Jacket", Price: 250, viewPrice: "250/pc", newQtyPrice: 250, img: "blazer.png", type: "dryclean" },
      { label: "3 Piece Suit", Price: 450, viewPrice: "450/pc", newQtyPrice: 450, img: "3_pc_suit.png", type: "dryclean" },
      { label: "2 Piece Suit", Price: 300, viewPrice: "300/pc", newQtyPrice: 300, img: "2_pc_suit.png", type: "dryclean" },
      { label: "Long Blazer", Price: 350, viewPrice: "350/pc", newQtyPrice: 350, img: "longblazer.png", type: "dryclean" },
      { label: "Sweatshirt / Hoodie", Price: 250, viewPrice: "250/pc", newQtyPrice: 250, img: "hoodie.png", type: "dryclean" },
      { label: "Winter Jacket", Price: 350, viewPrice: "350/pc", newQtyPrice: 350, img: "winter_jacket.jpg", type: "dryclean" },

      { label: "Heavy Saree", Price: 350, viewPrice: "350/pc", newQtyPrice: 350, img: "heavysaree.png", type: "dryclean" },
      { label: "Medium Saree", Price: 300, viewPrice: "300/pc", newQtyPrice: 300, img: "mediumsaree.png", type: "dryclean" },
      { label: "Saree", Price: 250, viewPrice: "250/pc", newQtyPrice: 250, img: "saree.png", type: "dryclean" },
      { label: "Blouse", Price: 80, viewPrice: "80/pc", newQtyPrice: 80, img: "blouse.png", type: "dryclean" },
      { label: "Heavy Blouse", Price: 120, viewPrice: "120/pc", newQtyPrice: 120, img: "heavy_blouse.webp", type: "dryclean" },

      { label: "Lehenga", Price: 250, viewPrice: "250/pc", newQtyPrice: 250, img: "lehenga.png", type: "dryclean" },
      { label: "Medium Lehenga", Price: 500, viewPrice: "500/pc", newQtyPrice: 500, img: "mediumlehenga.png", type: "dryclean" },
      { label: "Heavy Lehenga", Price: 700, viewPrice: "700/pc", newQtyPrice: 700, img: "heavy_lehenga.jpg", type: "dryclean" },

      { label: "Dress", Price: 350, viewPrice: "350/pc", newQtyPrice: 350, img: "dress.png", type: "dryclean" },
      { label: "Heavy Dress", Price: 500, viewPrice: "500/pc", newQtyPrice: 500, img: "heavy_dress.jpg", type: "dryclean" },
      { label: "Gown", Price: 200, viewPrice: "200/pc", newQtyPrice: 200, img: "gown.jpg", type: "dryclean" },
      { label: "Heavy Gown", Price: 300, viewPrice: "300/pc", newQtyPrice: 300, img: "heavy_gown.jpg", type: "dryclean" },

      { label: "Dupatta", Price: 80, viewPrice: "80/pc", newQtyPrice: 80, img: "dupatta.jpg", type: "dryclean" },
      { label: "Heavy Dupatta", Price: 100, viewPrice: "100/pc", newQtyPrice: 100, img: "heavy_duptta.jpg", type: "dryclean" },

      { label: "Kurta Pyjama", Price: 250, viewPrice: "250/pc", newQtyPrice: 250, img: "kurta_pajama.jpg", type: "dryclean" },
      { label: "Shawl", Price: 200, viewPrice: "200/pc", newQtyPrice: 200, img: "shwal.jpg", type: "dryclean" },
      { label: "Sweater / Cardigan", Price: 200, viewPrice: "200/pc", newQtyPrice: 200, img: "cardigin.jpg", type: "dryclean" },
      { label: "Shrug", Price: 200, viewPrice: "200/pc", newQtyPrice: 200, img: "srug.jpg", type: "dryclean" },

      { label: "Blanket (Single)", Price: 300, viewPrice: "300/pc", newQtyPrice: 300, img: "blanket(single).jpg", type: "dryclean" },
      { label: "Blanket (Double)", Price: 400, viewPrice: "400/pc", newQtyPrice: 400, img: "double_blanket.jpg", type: "dryclean" },

      { label: "Bed Sheet (Single)", Price: 200, viewPrice: "200/pc", newQtyPrice: 200, img: "bed_sheet_single.jpg", type: "dryclean" },
      { label: "Bed Sheet (Double)", Price: 300, viewPrice: "300/pc", newQtyPrice: 300, img: "bed_sheet_double.jpg", type: "dryclean" },

      { label: "Handbag (Small)", Price: 300, viewPrice: "300/pc", newQtyPrice: 300, img: "handbag_small.jpeg", type: "dryclean" },
      { label: "Handbag (Medium)", Price: 450, viewPrice: "450/pc", newQtyPrice: 450, img: "handbag_medium.jpg", type: "dryclean" },
      { label: "Handbag (Large)", Price: 450, viewPrice: "450/pc", newQtyPrice: 450, img: "handbag_large.jpg", type: "dryclean" },
    ],
  },

  /* ===================== SHOE SPA ===================== */
  shoespa: {
    label: "Shoe Spa",
    children: [
      { label: "Sport Shoes / Sneakers", Price: 500, viewPrice: "500/pc", newQtyPrice: 500, img: "sportsshoes.png", type: "shoespa" },
      { label: "Leather Shoes", Price: 600, viewPrice: "600/pc", newQtyPrice: 600, img: "leather_shoes.jpg", type: "shoespa" },
      { label: "Suede Shoes", Price: 600, viewPrice: "600/pc", newQtyPrice: 600, img: "suedeshoes.png", type: "shoespa" },
      { label: "Boots", Price: 700, viewPrice: "700/pc", newQtyPrice: 700, img: "boots.png", type: "shoespa" },
      { label: "Stilettos", Price: 600, viewPrice: "600/pc", newQtyPrice: 600, img: "stilettos.png", type: "shoespa" },
      { label: "Sliders", Price: 250, viewPrice: "250/pc", newQtyPrice: 250, img: "sliders.png", type: "shoespa" },
      { label: "Sandals", Price: 300, viewPrice: "300/pc", newQtyPrice: 300, img: "sandals.png", type: "shoespa" },
    ],
  },
};