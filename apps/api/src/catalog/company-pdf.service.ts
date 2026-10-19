import { Injectable, ForbiddenException, NotFoundException } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { hasAdminAccess, type PublicUser } from "@hipersales/contracts";
import { DatabaseRepository } from "../database/database.repository.js";

type Row=Record<string,unknown>;
const show=(v:unknown)=>String(v??"").trim()||"—";
@Injectable()
export class CompanyPdfService{
  constructor(private readonly database:DatabaseRepository){}
  async generate(user:PublicUser,id:number):Promise<Buffer>{
    if(!hasAdminAccess(user.role))throw new ForbiddenException("Acesso negado.");
    const company=await this.database.db.prepare("SELECT * FROM companies WHERE id=? AND tenant_id=?").get(id,user.tenant_id) as Row|undefined;
    if(!company)throw new NotFoundException("Empresa nao encontrada.");
    return new Promise((resolve,reject)=>{
      const doc=new PDFDocument({size:"A4",margin:50,info:{Title:"Ficha de Cadastro - "+show(company.legal_name||company.name)}});
      const chunks:Buffer[]=[];
      doc.on("data",(chunk:Buffer)=>chunks.push(chunk));
      doc.on("end",()=>resolve(Buffer.concat(chunks)));
      doc.on("error",reject);
      doc.font("Helvetica-Bold").fontSize(22).text("Ficha de Cadastro",{align:"center"});
      doc.moveDown(1.6);
      const rows:[string,unknown][]=[
        ["Código",String(company.id).padStart(4,"0")],["Razão Social",company.legal_name||company.name],
        ["Fantasia",company.trade_name||company.name],["CNPJ",company.cnpj],
        ["Inscrição Estadual",company.state_registration],["Regime Fiscal",company.tax_regime],
        ["Endereço",company.address],["Número",company.address_number],
        ["Complemento",company.address_complement],["Bairro",company.district],
        ["Município",company.city],["UF",company.state],["CEP",company.postal_code],
        ["Telefone",company.phone],["E-mail",company.email],["Site",company.website],
        ["Lead time (dias)",company.lead_time_days],["Situação",company.active?"Ativo":"Inativo"]
      ];
      const colW=160, baseX=50, rowHeight=62;
      for(let i=0;i<rows.length;i++){
        const column=i%3, line=Math.floor(i/3),x=baseX+column*colW,y=150+line*rowHeight;
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111").text(rows[i][0],x,y,{width:colW-12});
        doc.font("Helvetica").fontSize(9).text(show(rows[i][1]),x,y+17,{width:colW-12,height:41,ellipsis:true});
      }
      doc.end();
    });
  }
}
