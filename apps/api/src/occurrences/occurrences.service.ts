import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseService } from "../database/database.service.js";

type Row=Record<string,unknown>;
const str=(v:unknown)=>String(v??"");
const statusNames:Record<string,string>={aberta:"Aberta",em_analise:"Em analise",recusada:"Recusada",solucionada:"Solucionada"};
export function occurrenceStatus(value:unknown):string{
  const status=str(value).trim();
  const aliases:Record<string,string>={em_tratamento:"em_analise",tratada:"solucionada",encerrada:"solucionada",solucionado:"solucionada"};
  return aliases[status]||status;
}
@Injectable()
export class OccurrencesService {
  constructor(private readonly database:DatabaseService){}
  list(user:PublicUser){
    const db=this.database.db;
    const rows=db.prepare(`SELECT o.*,u.name AS seller_name,
      COALESCE(NULLIF(u.communication_email,''),u.email) AS seller_email,
      c.legal_name AS customer_name,c.trade_name AS customer_trade_name,
      c.cnpj AS customer_cnpj,c.state_registration AS customer_state_registration,
      c.address AS customer_address,c.phone AS customer_phone,c.email AS customer_email
      FROM occurrences o JOIN users u ON u.id=o.seller_id
      JOIN customers c ON c.id=o.customer_id
      WHERE o.tenant_id=? ${user.role==="admin"?"":"AND o.seller_id=?"}
      ORDER BY o.created_at DESC,o.id DESC`).all(...(user.role==="admin"?[user.tenant_id]:[user.tenant_id,user.id])) as Row[];
    const attachments=db.prepare(`SELECT id,filename,mimetype,created_at FROM occurrence_attachments
      WHERE occurrence_id=? AND tenant_id=? ORDER BY id`);
    const events=db.prepare(`SELECT oe.*,u.name AS created_by_name FROM occurrence_events oe
      LEFT JOIN users u ON u.id=oe.created_by
      WHERE oe.occurrence_id=? AND oe.tenant_id=? ORDER BY oe.created_at,oe.id`);
    return {occurrences:rows.map(row=>{
      let names:unknown=[];
      try{ names=JSON.parse(str(row.attachment_names||"[]")); }catch{names=[];}
      const attachmentNames=Array.isArray(names)?names:[];
      const attached=attachments.all(Number(row.id),user.tenant_id);
      const timeline=events.all(Number(row.id),user.tenant_id);
      const current=occurrenceStatus(row.status);
      if(!timeline.length){
        timeline.push({id:0,occurrence_id:row.id,status:"aberta",title:"Ocorrencia aberta",
          notes:"Registro enviado e aguardando verificacao da retaguarda.",
          created_by_name:row.seller_name,created_at:row.created_at});
        if(current!=="aberta"||row.updated_at!==row.created_at) timeline.push({
          id:0,occurrence_id:row.id,status:current,title:statusNames[current]||current,
          notes:row.resolution||"Status atualizado pela retaguarda.",
          created_by_name:"Retaguarda",created_at:row.updated_at||row.created_at,
        });
      }
      return {...row,attachment_names:attachmentNames,attachments:attached,
        attachments_expired:Boolean(attachmentNames.length&&!attached.length&&current==="solucionada"),timeline};
    })};
  }
  update(user:PublicUser,id:number,input:Row){
    if(!Number.isSafeInteger(id)||id<=0||!input||typeof input!=="object"||Array.isArray(input))
      throw new BadRequestException("Ocorrencia invalida.");
    return this.database.transaction(()=>{
      const db=this.database.db;
      const before=db.prepare("SELECT status,resolution,resolved_at FROM occurrences WHERE id=? AND tenant_id=?")
        .get(id,user.tenant_id) as Row|undefined;
      if(!before) throw new NotFoundException("Ocorrencia nao encontrada.");
      const status=occurrenceStatus(input.status||before.status);
      if(!(status in statusNames)) throw new BadRequestException("Status de ocorrencia invalido.");
      const resolution=str(input.resolution||"").trim();
      const now=new Date().toISOString();
      const resolvedAt=status==="solucionada"?(str(input.resolved_at||before.resolved_at)||now):null;
      db.prepare("UPDATE occurrences SET status=?,resolution=?,resolved_at=?,updated_at=? WHERE id=? AND tenant_id=?")
        .run(status,resolution,resolvedAt,now,id,user.tenant_id);
      if(occurrenceStatus(before.status)!==status||str(before.resolution).trim()!==resolution||str(before.resolved_at)!==str(resolvedAt))
        db.prepare(`INSERT INTO occurrence_events
          (occurrence_id,tenant_id,status,title,notes,created_by,created_at) VALUES (?,?,?,?,?,?,?)`)
          .run(id,user.tenant_id,status,statusNames[status],resolution||"Ocorrencia atualizada pela retaguarda.",user.id,now);
      return {message:"Ocorrencia atualizada."};
    });
  }
  delete(user:PublicUser,id:number){
    if(!Number.isSafeInteger(id)||id<=0) throw new BadRequestException("Ocorrencia invalida.");
    return this.database.transaction(()=>{
      const db=this.database.db;
      const result=db.prepare("DELETE FROM occurrences WHERE id=? AND tenant_id=?").run(id,user.tenant_id);
      if(!result.changes) throw new NotFoundException("Ocorrencia nao encontrada.");
      return {message:"Ocorrencia excluida definitivamente."};
    });
  }
}
