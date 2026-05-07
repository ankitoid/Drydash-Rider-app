import { oldApiClient } from "@/constants/axiosInstance";

export const getCatalogApi = async (slug: any) => {
  console.log("this is the slug", slug);
  const res = await oldApiClient.get(`/v1/catalog/${slug}?isActive=true`);
  console.log("this is the response==>>", res);
  return res;
};
