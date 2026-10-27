# Providers and local answers

Open **Settings**, edit the JSON, then select **Save settings**. Existing manager data is kept. Use the standard userscript for same-origin/loopback providers, or the **Custom Providers** variant for remote APIs. Install one variant at a time.

## Local bank

Local answers work without a network service:

```json
{
  "bank": [
    { "question": "Which number is even?", "answer": "Two", "source": "My notes" }
  ]
}
```

Bank entries match normalized question text. Use `#` between multiple answers or a JSON array string for ordered blanks. Program answers preserve syntax delimiters. Stored page content and answers keep their original language; application UI and documentation are English.

## JSON endpoint

```json
{
  "providers": [
    {
      "id": "my-bank",
      "name": "My question bank",
      "enabled": true,
      "kind": "json",
      "url": "https://api.example.com/search",
      "method": "POST",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" },
      "data": { "question": "${title}", "options": "${options}", "type": "${type}" },
      "resultsPath": "data.items",
      "questionPath": "question",
      "answerPath": "answer",
      "sendImages": false
    }
  ]
}
```

The expected response is `{"data":{"items":[{"question":"...","answer":"..."}]}}`. Paths support object keys, dot-separated numeric array positions and `[0]` indexing. An empty `resultsPath` selects the whole response. If the result omits the question field, the current question is used. Results naming another question are excluded. Arrays of answer strings become JSON-array answers.

Available templates are `${title}`, `${options}`, `${type}` and `${images}`. Templates recurse through request data. URL templates are percent-encoded. GET data becomes query parameters. POST defaults to JSON; set `Content-Type: application/x-www-form-urlencoded` for form bodies. Requests omit browser cookies. Use explicit provider authentication headers. HTTPS is required except for loopback HTTP.

`sendImages` defaults to false. When enabled, `${images}` contains a JSON string of the extracted page image URLs. This sends page image locations to the selected provider.

## OpenAI-compatible endpoint

```json
{
  "providers": [
    {
      "id": "assistant",
      "name": "My assistant",
      "kind": "openai",
      "url": "https://api.example.com/v1/chat/completions",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" },
      "model": "YOUR_MODEL",
      "data": { "temperature": 0 },
      "sendImages": false
    }
  ]
}
```

This uses the chat-completions JSON wire format, rather than a specific SDK or hosted provider. Configure the full endpoint and a model supported by that service. The assistant requests option letters or an ordered blank array, and reads `choices[0].message.content`. Extra `data` fields customize the request except for the fixed model/messages/stream fields. Optional vision sends HTTPS image URLs and embedded raster data URLs under 1 MB. Protected images are not downloaded or converted.

## Migrating executable wrappers

Legacy `handler` strings and `data.*.handler` fields are rejected. Replace `res.data.items.map(...)` with `resultsPath: "data.items"`, then set the two result-field paths. If a provider needs a computed signature or unusual transformation, put that logic in a service you control and return the JSON format above. Old wrappers and credentials remain in manager storage for manual reference.

## Connection popup

Set `connectUrl` to a provider-controlled HTTPS connection page. Click **Connect provider**. The connection page receives the course origin in its `from` query parameter and can return:

```javascript
window.opener.postMessage({
  type: 'ocsjs-providers',
  version: 1,
  config: [/* declarative provider objects */]
}, new URL(location.href).searchParams.get('from'));
```

The receiver checks the popup object, exact origin, protocol version and configuration schema. The popup closes after success, invalid data, timeout, page exit or cancellation. The legacy `ocs-answerer-config` message name is accepted only with the same declarative schema.
