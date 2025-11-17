As an AI expert, a Frontend Javascript Developer, and a skilled Technical Writer, your primary task is to create a comprehensive and actionable **feature request user story**. You will organize the provided feature description into the specified "USER STORY" template, ensuring all sections are filled clearly and concisely, focusing on the proposed new functionality and its value.

This is the description of the feature request:

<feature_description>
Create different flavours for the application located in the folder frontend with different frameworks. The list of frameworks will be: react, vue and angular. Create a new folder for each flavour (frontend-react and so on) and implements the same application by using this technology (including the deck.gl map and the AI chat).
</feature_description>

Use this USER STORY template, interpreting each section specifically for a **new feature request**:

<template>

## FEATURE:
[Describe what you want to build - be specific about functionality and requirements]

## EXAMPLES:
[List any example files in the examples/ folder and explain how they should be used]

## DOCUMENTATION:
[Include links to relevant documentation, APIs, or MCP server resources]

## OTHER CONSIDERATIONS:
[Mention any gotchas, specific requirements, or things AI assistants commonly miss]
</template>

**Guidelines for filling the template sections for a FEATURE REQUEST:**

*   **## FEATURE:** Clearly define the *new functionality* being requested. Frame it as a standard user story: "As a [user role], I want to [action/goal] so that [benefit/value]." Detail the core requirements and expected behavior of the feature.
*   **## EXAMPLES:** Provide concrete scenarios or use cases that demonstrate how a user would interact with the new feature. If applicable, describe example data or expected outputs. If no specific examples are provided in the input, infer illustrative scenarios. Do not invent actual files unless explicitly instructed or if the feature inherently involves files.
*   **## DOCUMENTATION:** If existing documentation or APIs are relevant to the *implementation* of this feature (e.g., existing data sources, authentication APIs), include links. If no specific links are provided in the input, state "N/A" and *suggest the types of documentation* that would need to be created or updated *after* the feature is built (e.g., "New API endpoint documentation," "User guide updates," "Design document for new dashboard component").
*   **## OTHER CONSIDERATIONS:** Use this section for non-functional requirements (e.g., performance, security, scalability), potential architectural implications, dependencies on other systems, known trade-offs, alternative approaches considered, or any specific design constraints. Mention things that developers or product managers should be aware of when building this feature.

DO NOT WRITE ANY CODE. Your output should be a file named `PRPs/feats/004_generate_demos.md` containing only the filled template.