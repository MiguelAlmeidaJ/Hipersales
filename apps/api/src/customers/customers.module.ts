import { Module } from "@nestjs/common";
import { ApprovalNotificationsService } from "./approval-notifications.service.js";
import { RegistrationReviewService } from "./registration-review.service.js";
import { RegistrationRequestsService } from "./registration-requests.service.js";
import { RegistrationSubmissionService } from "./registration-submission.service.js";
import { AssignmentsController } from "./assignments.controller.js";
import { AssignmentsService } from "./assignments.service.js";
import { CustomersController } from "./customers.controller.js";
import { CustomersService } from "./customers.service.js";
import { CustomersWriteService } from "./customers-write.service.js";
import { CnpjLookupService } from "./cnpj-lookup.service.js";
import { CustomerRegistrationService } from "./customer-registration.service.js";

@Module({
  controllers: [CustomersController, AssignmentsController],
  providers: [CustomersService, CustomersWriteService, CnpjLookupService, CustomerRegistrationService, AssignmentsService, RegistrationRequestsService, RegistrationSubmissionService, RegistrationReviewService, ApprovalNotificationsService],
})
export class CustomersModule {}
