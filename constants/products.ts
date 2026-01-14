export type ProductItem = {
  label: string;
  Price: number;
  viewPrice: string;
  newQtyPrice: number;
  img: string;
  type: "laundry" | "drywash" | "shoe";
};
 
export type ProductCategory = {
  label: string;
  children: ProductItem[];
};
 
export const PRODUCTS: Record<"laundry" | "drywash" | "shoe", ProductCategory> =
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
    drywash: {
      label: "DryClean",
      children: [
        { label: "Shirt / T-Shirt", Price: 100, viewPrice: "100/pc", newQtyPrice: 100, img: "shirt.png", type: "drywash" },
        { label: "Jeans", Price: 120, viewPrice: "120/pc", newQtyPrice: 120, img: "jeans.png", type: "drywash" },
        { label: "Trousers", Price: 100, viewPrice: "100/pc", newQtyPrice: 100, img: "trouser.png", type: "drywash" },
        { label: "Blazer / Jacket", Price: 250, viewPrice: "250/pc", newQtyPrice: 250, img: "blazer.png", type: "drywash" },
        { label: "3 Piece Suit", Price: 450, viewPrice: "450/pc", newQtyPrice: 450, img: "3_pc_suit.png", type: "drywash" },
        { label: "2 Piece Suit", Price: 300, viewPrice: "300/pc", newQtyPrice: 300, img: "2_pc_suit.png", type: "drywash" },
        { label: "Long Blazer", Price: 350, viewPrice: "350/pc", newQtyPrice: 350, img: "longblazer.png", type: "drywash" },
        { label: "Sweatshirt / Hoodie", Price: 250, viewPrice: "250/pc", newQtyPrice: 250, img: "hoodie.png", type: "drywash" },
        { label: "Winter Jacket", Price: 350, viewPrice: "350/pc", newQtyPrice: 350, img: "winter_jacket.jpg", type: "drywash" },
 
        { label: "Heavy Saree", Price: 350, viewPrice: "350/pc", newQtyPrice: 350, img: "heavysaree.png", type: "drywash" },
        { label: "Medium Saree", Price: 300, viewPrice: "300/pc", newQtyPrice: 300, img: "mediumsaree.png", type: "drywash" },
        { label: "Saree", Price: 250, viewPrice: "250/pc", newQtyPrice: 250, img: "saree.png", type: "drywash" },
        { label: "Blouse", Price: 80, viewPrice: "80/pc", newQtyPrice: 80, img: "blouse.png", type: "drywash" },
        { label: "Heavy Blouse", Price: 120, viewPrice: "120/pc", newQtyPrice: 120, img: "heavy_blouse.webp", type: "drywash" },
 
        { label: "Lehenga", Price: 250, viewPrice: "250/pc", newQtyPrice: 250, img: "lehenga.png", type: "drywash" },
        { label: "Medium Lehenga", Price: 500, viewPrice: "500/pc", newQtyPrice: 500, img: "mediumlehenga.png", type: "drywash" },
        { label: "Heavy Lehenga", Price: 700, viewPrice: "700/pc", newQtyPrice: 700, img: "heavy_lehenga.jpg", type: "drywash" },
 
        { label: "Dress", Price: 350, viewPrice: "350/pc", newQtyPrice: 350, img: "dress.png", type: "drywash" },
        { label: "Heavy Dress", Price: 500, viewPrice: "500/pc", newQtyPrice: 500, img: "heavy_dress.jpg", type: "drywash" },
        { label: "Gown", Price: 200, viewPrice: "200/pc", newQtyPrice: 200, img: "gown.jpg", type: "drywash" },
        { label: "Heavy Gown", Price: 300, viewPrice: "300/pc", newQtyPrice: 300, img: "heavy_gown.jpg", type: "drywash" },
 
        { label: "Dupatta", Price: 80, viewPrice: "80/pc", newQtyPrice: 80, img: "dupatta.jpg", type: "drywash" },
        { label: "Heavy Dupatta", Price: 100, viewPrice: "100/pc", newQtyPrice: 100, img: "heavy_duptta.jpg", type: "drywash" },
 
        { label: "Kurta Pyjama", Price: 250, viewPrice: "250/pc", newQtyPrice: 250, img: "kurta_pajama.jpg", type: "drywash" },
        { label: "Shawl", Price: 200, viewPrice: "200/pc", newQtyPrice: 200, img: "shwal.jpg", type: "drywash" },
        { label: "Sweater / Cardigan", Price: 200, viewPrice: "200/pc", newQtyPrice: 200, img: "cardigin.jpg", type: "drywash" },
        { label: "Shrug", Price: 200, viewPrice: "200/pc", newQtyPrice: 200, img: "srug.jpg", type: "drywash" },
 
        { label: "Blanket (Single)", Price: 300, viewPrice: "300/pc", newQtyPrice: 300, img: "blanket(single).jpg", type: "drywash" },
        { label: "Blanket (Double)", Price: 400, viewPrice: "400/pc", newQtyPrice: 400, img: "double_blanket.jpg", type: "drywash" },
 
        { label: "Bed Sheet (Single)", Price: 200, viewPrice: "200/pc", newQtyPrice: 200, img: "bed_sheet_single.jpg", type: "drywash" },
        { label: "Bed Sheet (Double)", Price: 300, viewPrice: "300/pc", newQtyPrice: 300, img: "bed_sheet_double.jpg", type: "drywash" },
 
        { label: "Handbag (Small)", Price: 300, viewPrice: "300/pc", newQtyPrice: 300, img: "handbag_small.jpeg", type: "drywash" },
        { label: "Handbag (Medium)", Price: 450, viewPrice: "450/pc", newQtyPrice: 450, img: "handbag_medium.jpg", type: "drywash" },
        { label: "Handbag (Large)", Price: 450, viewPrice: "450/pc", newQtyPrice: 450, img: "handbag_large.jpg", type: "drywash" },
      ],
    },
 
    /* ===================== SHOE SPA ===================== */
    shoe: {
      label: "Shoe Spa",
      children: [
        { label: "Sport Shoes / Sneakers", Price: 500, viewPrice: "500/pc", newQtyPrice: 500, img: "sportsshoes.png", type: "shoe" },
        { label: "Leather Shoes", Price: 600, viewPrice: "600/pc", newQtyPrice: 600, img: "leather_shoes.jpg", type: "shoe" },
        { label: "Suede Shoes", Price: 600, viewPrice: "600/pc", newQtyPrice: 600, img: "suedeshoes.png", type: "shoe" },
        { label: "Boots", Price: 700, viewPrice: "700/pc", newQtyPrice: 700, img: "boots.png", type: "shoe" },
        { label: "Stilettos", Price: 600, viewPrice: "600/pc", newQtyPrice: 600, img: "stilettos.png", type: "shoe" },
        { label: "Sliders", Price: 250, viewPrice: "250/pc", newQtyPrice: 250, img: "sliders.png", type: "shoe" },
        { label: "Sandals", Price: 300, viewPrice: "300/pc", newQtyPrice: 300, img: "sandals.png", type: "shoe" },
      ],
    },
  };