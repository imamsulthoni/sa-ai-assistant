# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Systems Analysts, Product Managers, Tech Leads, and Software Engineers in enterprise and agile environments who need to turn unstructured user stories or legacy docs into verified, production-ready Business Requirement Documents (BRDs).

## Product Purpose
Halodocs is an AI Systems Analyst platform that turns rough user stories into audit-ready BRDs complete with Mermaid flowcharts, formal FR/BR IDs, and Given/When/Then acceptance criteria through disciplined clarification loops and Git-style diff reviews.

## Positioning
Unlike generic AI chatbots that hallucinate business rules or quietly mutate requirements, Halodocs enforces a professional Systems Analyst methodology: maximum 2-round targeted clarification to resolve ambiguities, line-by-line visual diff reviews before any commit, project-scoped RAG grounding, and enterprise audit tracking.

## Operating Context
Web platform workspace, sprint grooming, architecture and security reviews, engineering handoffs, banking and enterprise compliance workflows.

## Capabilities and Constraints
- Ingestion of user stories or legacy documents (PDF, DOCX, MD, TXT, OCR images)
- Extraction into company template structure with standardized BR-### / FR-### nomenclature
- Two-round structured clarification for edge cases, SLAs, and integration fallbacks
- Automatic generation and rendering of Mermaid sequence and workflow diagrams
- Git-style diff review (Side-by-Side and line changes) with explicit user approval
- Version snapshot history, rollback, and comparison
- Markdown and official paginated PDF export with watermark states

## Brand Commitments
- Name: Halodocs
- Tagline: SA AI Assistant
- Aesthetic: Instrument panel — square corners, crisp 1px borders, dense typography, one signal color per theme (indigo in light, lime on graphite in dark) reserved for action, selection, and verified state; no AI slop or empty marketing fluff

## Evidence on Hand
- Full workspace platform in `apps/platform` with TanStack Router, Tailwind CSS v4, Lucide icons
- Mermaid diagram rendering engine and diff computation utilities

## Product Principles
1. Zero Hallucination: Ambiguities require targeted clarification before drafting.
2. Complete Control: No spec changes apply without explicit user diff review and approval.
3. Engineering-Grade Output: Standardized FR/BR schema, Mermaid diagrams, and BDD acceptance criteria.
4. Compact High-Density Utility: Professional workflow with zero AI slop, no generic cards, and instant scanability.
