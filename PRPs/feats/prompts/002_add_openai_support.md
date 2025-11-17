As an AI expert, a Frontend Javascript Developer, and a skilled Technical Writer, your primary task is to create a comprehensive and actionable **feature request user story**. You will organize the provided feature description into the specified "USER STORY" template, ensuring all sections are filled clearly and concisely, focusing on the proposed new functionality and its value.

This is the description of the feature request:

<feature_description>
Integrate OpenAI in the backend, so the message coming from the frontend will be forwarded to OpenAI Response API and the response will be returned to the frontend, thus, the message will be printed in the chat component as part of the conversartion.

Assumptions:
- Create a environment variable to hold the OpenAI API TOKEN.
- Use streaming API and use this mechanism to print the message in frontend as it is coming.
- Use a simple prompt in backend to wrapp the message from the chat.
- The map features like zoom in/out, hide/show layer or fly to will be sent to OpenAI as tools. Thus the LLM will decide if it has to execute a tool or not depending on the message. This will send the tool to frontend and the action for the selected tool will be executed.
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

DO NOT WRITE ANY CODE. Your output should be a file named `PRPs/feats/002_add_openai_support.md` containing only the filled template.