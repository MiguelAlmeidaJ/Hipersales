"use client";
import { useParams } from "next/navigation";
import SellerPortfolioPage from "@/components/users/seller-portfolio-page";
export default function Page() {
  const params = useParams<{ id: string }>();
  return <SellerPortfolioPage id={params.id} />;
}
