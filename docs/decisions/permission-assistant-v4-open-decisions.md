# Permission Assistant V4 Open Product Decisions

Status: waiting for the final development PRD.

This document is a change-control checklist, not a request to freeze the current draft.

## Approval Submission

- Identify the Feishu approval definition used by V1.
- Decide whether one application with different routes creates one approval instance or multiple instances.
- Define what the employee sees when one sub-application fails to submit.
- Define withdrawal, rejection, supplementation, resubmission, cancellation, and timeout behavior.
- Define whether route nodes come from local configuration, Feishu definitions, or both.

## Identity And Organization

- Confirm the system of record for employee number, company, department, position, direct manager, and department head.
- Define behavior when an employee or approver cannot be resolved.
- Define department-administrator scope and cross-department visibility.
- Define transfer and departure behavior only where it changes V1 applications or entitlements.

## Permission Lifecycle

- Define the source of truth for owned permissions.
- Define the distinction between approval passed, provisioning, active, failed, expired, and revoked.
- Confirm whether V1 renewal and revocation are manual records or real system integrations.
- Define effective-date validation and maximum-duration rules.

## Catalog And Forms

- Confirm the catalog hierarchy and classification rules.
- Confirm prerequisite, conflict, duplicate, and already-owned behavior.
- Confirm which dynamic fields and attachment scenarios are mandatory in V1.
- Confirm whether shared and per-permission reasons can coexist in one application.

## Operations And Audit

- Confirm which roles may create, edit, enable, disable, and publish permission configuration.
- Confirm the minimum audit history visible to administrators.
- Confirm required notification channels and reminder timing.
- Confirm the manual recovery path when Feishu or a target system is unavailable.
