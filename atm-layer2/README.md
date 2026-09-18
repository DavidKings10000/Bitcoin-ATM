## ITL NV200 + SMART Payout integration

The Layer 2 server communicates with the existing hardware sidecar through `HARDWARE_URL` (default: `http://localhost:5000/api`). The sidecar is responsible for the physical ITL SSP/eSSP serial or USB session, including validator initialization, encryption/session handling, cashbox state, and SMART Payout commands.

The sidecar contract used by Layer 2 is:

- `GET /status`: identity, `ready`, connection state, components, capabilities, payout capacity, and supported denominations
- `POST /enable` and `POST /disable`: enable or inhibit the device
- `POST /accept`: begin validator acceptance
- `POST /payout` with `{ "amount": 500, "currency": "KES" }`: dispense through SMART Payout

The bundled simulator implements this contract for development. It models the NV200 validator, cashbox, and SMART Payout module and does not pretend to be the physical SSP/eSSP driver. Configure `HARDWARE_URL` to the production sidecar when deploying real ITL hardware.
