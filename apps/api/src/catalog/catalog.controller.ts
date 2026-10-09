import { Controller, Get, Query, Req, Post, Patch, Delete, Param, Body, ParseIntPipe } from "@nestjs/common";
import { companyMutationSchema, productImportSchema, productMutationSchema,
  type CompanyMutation, type ProductImport, type ProductMutation } from "@hipersales/contracts";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import { CatalogService } from "./catalog.service.js";
import { CatalogTransferService } from "./catalog-transfer.service.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";

@Controller("api")
export class CatalogController {
  constructor(private readonly catalog: CatalogService, private readonly transfers: CatalogTransferService) {}

  @Get("companies")
  companies(@Req() request: AuthenticatedRequest) {
    return this.catalog.companies(request.user);
  }

  @Get("products")
  products(
    @Req() request: AuthenticatedRequest,
    @Query("company_id") companyId = "0",
    @Query("q") search = "",
  ) {
    return this.catalog.products(request.user, Number(companyId || 0), search);
  }

  @Roles("admin")
  @Get("admin/companies")
  adminCompanies(
    @Req() request: AuthenticatedRequest,
    @Query("q") search = "",
    @Query("active") active = "all",
  ) {
    return this.catalog.adminCompanies(request.user, search, active);
  }

  @Roles("admin")
  @Get("admin/products")
  adminProducts(
    @Req() request: AuthenticatedRequest,
    @Query("company_id") companyId = "",
    @Query("q") search = "",
    @Query("active") active = "all",
  ) {
    return this.catalog.adminProducts(request.user, companyId, search, active);
  }
  @Roles("admin")
  @Post("admin/companies")
  createCompany(@Req() request:AuthenticatedRequest,@Body(new ZodValidationPipe(companyMutationSchema)) data:CompanyMutation) {
    return this.catalog.createCompany(request.user,data);
  }

  @Roles("admin")
  @Patch("admin/companies/:id")
  updateCompany(@Req() request:AuthenticatedRequest,@Param("id",ParseIntPipe) id:number,
    @Body(new ZodValidationPipe(companyMutationSchema)) data:CompanyMutation) {
    return this.catalog.updateCompany(request.user,id,data);
  }

  @Roles("admin")
  @Delete("admin/companies/:id")
  deleteCompany(@Req() request: AuthenticatedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.catalog.deleteCompany(request.user, id);
  }


  @Roles("admin")
  @Get("admin/products/export")
  exportProducts(@Req() request: AuthenticatedRequest, @Query("company_id") companyId = "", @Query("q") search = "", @Query("active") active = "all") {
    return this.transfers.exportProducts(request.user,companyId,search,active);
  }

  @Roles("admin")
  @Post("admin/products/import")
  importProducts(@Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(productImportSchema)) input: ProductImport) {
    return this.transfers.importProducts(request.user,input);
  }
  @Roles("admin")
  @Post("admin/products")
  createProduct(@Req() request:AuthenticatedRequest,
    @Body(new ZodValidationPipe(productMutationSchema)) data:ProductMutation) {
    return this.catalog.createProduct(request.user,data);
  }

  @Roles("admin")
  @Patch("admin/products/:id")
  updateProduct(@Req() request:AuthenticatedRequest,@Param("id",ParseIntPipe) id:number,
    @Body(new ZodValidationPipe(productMutationSchema)) data:ProductMutation) {
    return this.catalog.updateProduct(request.user,id,data);
  }

  @Roles("admin")
  @Delete("admin/products/:id")
  deleteProduct(@Req() request:AuthenticatedRequest,@Param("id",ParseIntPipe) id:number) {
    return this.catalog.deleteProduct(request.user,id);
  }

}
