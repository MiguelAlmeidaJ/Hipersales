import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { GoalPerformance, PublicUser, SaveGoalsRequest } from "@hipersales/contracts";
import { DatabaseService } from "../database/database.service.js";
import { EnvService } from "../config/env.service.js";

type DbRow = Record<string, unknown>;
const REMINDER_DAYS = [10, 15, 20, 25, 27, 28, 29, 30];

function timezoneParts(date: Date, timezone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

function zonedMidnightUtc(year: number, month: number, timezone: string): string {
  const desired = Date.UTC(year, month - 1, 1);
  let guess = desired;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = timezoneParts(new Date(guess), timezone);
    const represented = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!);
    guess += desired - represented;
  }
  return new Date(guess).toISOString();
}

function nullableNumber(value: unknown, integer = false): number | null {
  if (value === null || value === undefined || value === "") return null;
  const compact = String(value).trim().replace("R$", "").replace("%", "").replaceAll(" ", "");
  const normalized = compact.includes(",") && compact.includes(".")
    ? compact.replaceAll(".", "").replace(",", ".")
    : compact.replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) throw new BadRequestException("Valor de meta invalido.");
  return integer ? Math.trunc(parsed) : parsed;
}

@Injectable()
export class GoalsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly env: EnvService,
  ) {
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: env.reportTimezone }).format();
    } catch {
      throw new Error("HYPERSALES_REPORT_TIMEZONE invalido.");
    }
  }

  mine(user: PublicUser, year?: string, month?: string) {
    const period = this.period(year, month);
    const seller = this.database.db
      .prepare("SELECT id, name FROM users WHERE id = ? AND tenant_id = ? AND role = 'seller'")
      .get(user.id, user.tenant_id) as DbRow | undefined;
    if (!seller) throw new NotFoundException("Representante nao encontrado.");
    return { seller, goals: this.performance(user.tenant_id, user.id, period.year, period.month) };
  }

  admin(user: PublicUser, year?: string, month?: string) {
    const period = this.period(year, month);
    const sellers = this.database.db
      .prepare(`SELECT id, name, email, communication_email, whatsapp_phone, active
        FROM users WHERE tenant_id = ? AND role = 'seller' ORDER BY active DESC, name`)
      .all(user.tenant_id) as DbRow[];
    return {
      year: period.year,
      month: period.month,
      rows: sellers.map((seller) => ({
        seller,
        goals: this.performance(user.tenant_id, Number(seller.id), period.year, period.month),
      })),
      reminder_days: REMINDER_DAYS,
    };
  }

  save(user: PublicUser, input: SaveGoalsRequest) {
    const period = this.period(input.year, input.month);
    return this.database.transaction(() => {
      let saved = 0;
      let removed = 0;
      for (const row of input.goals) {
        const seller = this.database.db
          .prepare("SELECT 1 FROM users WHERE id = ? AND tenant_id = ? AND role = 'seller'")
          .get(row.seller_id, user.tenant_id);
        if (!seller) continue;
        const salesGoal = nullableNumber(row.sales_goal);
        const customersGoal = nullableNumber(row.new_customers_goal, true);
        const positivationGoal = nullableNumber(row.customer_positivation_goal);
        if (salesGoal === null && customersGoal === null && positivationGoal === null) {
          const result = this.database.db
            .prepare("DELETE FROM seller_goals WHERE tenant_id = ? AND seller_id = ? AND year = ? AND month = ?")
            .run(user.tenant_id, row.seller_id, period.year, period.month);
          removed += Number(result.changes);
          continue;
        }
        this.database.db
          .prepare(`INSERT INTO seller_goals
            (tenant_id, seller_id, year, month, sales_goal, new_customers_goal,
             customer_positivation_goal, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(tenant_id, seller_id, year, month) DO UPDATE SET
              sales_goal = excluded.sales_goal,
              new_customers_goal = excluded.new_customers_goal,
              customer_positivation_goal = excluded.customer_positivation_goal,
              updated_at = excluded.updated_at`)
          .run(
            user.tenant_id,
            row.seller_id,
            period.year,
            period.month,
            salesGoal,
            customersGoal,
            positivationGoal,
            new Date().toISOString(),
          );
        saved += 1;
      }
      return {
        message: `Metas salvas. ${saved} representante(s) atualizado(s).`,
        saved,
        removed,
      };
    });
  }

  performance(tenantId: number, sellerId: number, year: number, month: number): GoalPerformance {
    const period = this.period(year, month);
    const goals = (this.database.db
      .prepare(`SELECT sales_goal, new_customers_goal, customer_positivation_goal
        FROM seller_goals WHERE tenant_id = ? AND seller_id = ? AND year = ? AND month = ?`)
      .get(tenantId, sellerId, period.year, period.month) ?? {}) as DbRow;
    const sales = this.database.db
      .prepare(`SELECT COALESCE(SUM(order_totals.total), 0) AS total
        FROM proposals p
        LEFT JOIN (
          SELECT p2.id, SUM(pi.quantity * pi.negotiated_price) AS total
          FROM proposals p2 LEFT JOIN proposal_items pi ON pi.proposal_id = p2.id
          WHERE p2.tenant_id = ? AND p2.seller_id = ? AND p2.created_at >= ? AND p2.created_at < ?
          GROUP BY p2.id
        ) order_totals ON order_totals.id = p.id
        WHERE p.tenant_id = ? AND p.seller_id = ? AND p.status <> 'recusado'
          AND p.created_at >= ? AND p.created_at < ?`)
      .get(tenantId, sellerId, period.start, period.end, tenantId, sellerId, period.start, period.end) as DbRow;
    const newCustomers = this.database.db
      .prepare(`SELECT COUNT(*) AS total FROM registration_requests
        WHERE tenant_id = ? AND seller_id = ? AND status = 'aprovada'
          AND created_at >= ? AND created_at < ?`)
      .get(tenantId, sellerId, period.start, period.end) as DbRow;
    const portfolio = this.database.db
      .prepare(`SELECT COUNT(DISTINCT c.id) AS total FROM customer_sellers cs
        JOIN customers c ON c.id = cs.customer_id
        WHERE c.tenant_id = ? AND c.active = 1 AND cs.seller_id = ?`)
      .get(tenantId, sellerId) as DbRow;
    const attended = this.database.db
      .prepare(`SELECT COUNT(DISTINCT p.customer_id) AS total FROM proposals p
        JOIN customers c ON c.id = p.customer_id
        WHERE p.tenant_id = ? AND p.seller_id = ? AND c.active = 1
          AND p.status <> 'recusado' AND p.created_at >= ? AND p.created_at < ?`)
      .get(tenantId, sellerId, period.start, period.end) as DbRow;
    const portfolioCount = Number(portfolio.total ?? 0);
    const attendedCount = Number(attended.total ?? 0);
    const positivation = portfolioCount ? (attendedCount / portfolioCount) * 100 : 0;
    return {
      year: period.year,
      month: period.month,
      has_goals: [goals.sales_goal, goals.new_customers_goal, goals.customer_positivation_goal]
        .some((goal) => goal !== null && goal !== undefined && goal !== ""),
      sales: this.progress(goals.sales_goal, Number(sales.total ?? 0)),
      new_customers: this.progress(goals.new_customers_goal, Number(newCustomers.total ?? 0)),
      customer_positivation: this.progress(goals.customer_positivation_goal, positivation),
      portfolio: { customers: portfolioCount, attended: attendedCount },
    };
  }

  private progress(goal: unknown, realized: number) {
    if (goal === null || goal === undefined || goal === "") {
      return { enabled: false, goal: null, realized, missing: 0, percent: 0 };
    }
    const goalValue = Number(goal);
    return {
      enabled: true,
      goal: goalValue,
      realized,
      missing: Math.max(0, goalValue - realized),
      percent: goalValue > 0 ? Math.min(100, (realized / goalValue) * 100) : 100,
    };
  }

  private period(yearInput?: string | number, monthInput?: string | number) {
    const current = timezoneParts(new Date(), this.env.reportTimezone);
    const requestedYear = Number(yearInput);
    const requestedMonth = Number(monthInput);
    const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
      ? requestedYear
      : current.year!;
    const month = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
      ? requestedMonth
      : current.month!;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    return {
      year,
      month,
      start: zonedMidnightUtc(year, month, this.env.reportTimezone),
      end: zonedMidnightUtc(nextYear, nextMonth, this.env.reportTimezone),
    };
  }
}
