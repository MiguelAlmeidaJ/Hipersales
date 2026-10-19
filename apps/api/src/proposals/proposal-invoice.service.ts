import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { hasAdminAccess, type PublicUser } from "@hipersales/contracts";
import { DatabaseRepository } from "../database/database.repository.js";

@Injectable()
export class ProposalInvoiceService {
  constructor(private readonly database:DatabaseRepository){}
  private async authorize(user:PublicUser,id:number) {
    const order=await this.database.db.prepare("SELECT seller_id FROM proposals WHERE id=? AND tenant_id=?").get(id,user.tenant_id) as {seller_id:number}|undefined;
    if(!order)throw new NotFoundException("Pedido nao encontrado.");
    if(!hasAdminAccess(user.role) && order.seller_id!==user.id)throw new ForbiddenException("Acesso negado.");
  }
  async upload(user:PublicUser,id:number,data:Record<string,unknown>){
    if(!hasAdminAccess(user.role))throw new ForbiddenException("Acesso negado.");
    await this.authorize(user,id);
    const filename=String(data.filename||"nota-fiscal.pdf").trim().slice(0,180);
    const encoded=String(data.content||"");
    if(!filename.toLowerCase().endsWith(".pdf") || !encoded || encoded.length>14_000_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length%4!==0)
      throw new BadRequestException("PDF invalido ou maior que 10 MB.");
    const buffer=Buffer.from(encoded,"base64");
    if(buffer.length>10*1024*1024 || buffer.subarray(0,5).toString("ascii")!=="%PDF-")
      throw new BadRequestException("O arquivo deve ser um PDF valido de ate 10 MB.");
    await this.database.transaction(async()=>{
      await this.database.db.prepare("DELETE FROM proposal_invoice_files WHERE proposal_id=? AND tenant_id=?").run(id,user.tenant_id);
      await this.database.db.prepare("INSERT INTO proposal_invoice_files (proposal_id,tenant_id,filename,mimetype,content,uploaded_at) VALUES (?,?,?,?,?,?)").run(id,user.tenant_id,filename,"application/pdf",buffer,new Date().toISOString());
    });
    return {message:"Nota fiscal anexada."};
  }
  async download(user:PublicUser,id:number){
    await this.authorize(user,id);
    const file=await this.database.db.prepare("SELECT filename,content FROM proposal_invoice_files WHERE proposal_id=? AND tenant_id=?").get(id,user.tenant_id) as {filename:string;content:Uint8Array}|undefined;
    if(!file)throw new NotFoundException("PDF da nota fiscal nao encontrado.");
    return {filename:file.filename,content:Buffer.from(file.content)};
  }
}
