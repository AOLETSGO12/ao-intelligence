/**
 * Demo data for the product dashboard.
 *
 * Everything on dashboard.html is drawn from this file so a real backend
 * can later replace it with live responses in the same shape.
 *
 * This is obviously fictional sample data for the prototype only.
 */
window.DEMO_DATA = {
  isDemo: true,
  demoLabel: "Demo data",
  overviewDateLabel: "Today",
  businesses: [
    {
      id: "rise-and-crumb",
      name: "Rise & Crumb Bakery",
      shortName: "Rise & Crumb",
      type: "Bakery",
      agent: {
        name: "Rise & Crumb Assistant",
        status: "Active",
        managedBy: "Managed by your AI agent",
        since: "March 2026"
      },
      emails: [
        {
          id: "rc-1",
          address: "hello@riseandcrumb.example",
          provider: "Gmail",
          status: "Connected",
          linkedOn: "12 March 2026"
        },
        {
          id: "rc-2",
          address: "orders@riseandcrumb.example",
          provider: "Outlook",
          status: "Connected",
          linkedOn: "14 March 2026"
        }
      ],
      overview: {
        intro: "A quiet morning inbox, with a few things worth a look before the lunch rush.",
        categories: [
          {
            id: "needs-reply",
            label: "Needs a reply",
            count: 4,
            tone: "attention",
            summary: "A wedding-cake enquiry for June, a regular asking about Saturday loaves, a supplier waiting on a flour order confirmation, and a local paper requesting a quote for a food feature."
          },
          {
            id: "invoices",
            label: "Invoices and payments",
            count: 3,
            tone: "money",
            summary: "A mill invoice is due on Tuesday, yesterday’s card-reader payout has landed, and a café wholesale account is waiting on a revised receipt."
          },
          {
            id: "bookings",
            label: "Bookings",
            count: 2,
            tone: "calendar",
            summary: "A Saturday market stall is confirmed for next weekend, and the primary school has asked to move their bakery visit to Thursday morning."
          },
          {
            id: "newsletters",
            label: "Newsletters",
            count: 6,
            tone: "quiet",
            summary: "Trade news, a seasonal recipe round-up, and four supplier promotions. Nothing urgent — all filed for later."
          }
        ]
      },
      activity: [
        {
          id: "rc-a1",
          time: "7:12 am",
          title: "Prepared the daily overview",
          detail: "Read 23 new messages across both inboxes and grouped them for this morning’s briefing."
        },
        {
          id: "rc-a2",
          time: "7:14 am",
          title: "Flagged a wedding-cake enquiry",
          detail: "Maya Chen asked about a two-tier lemon cake for 20 June. Draft reply is ready for you to approve."
        },
        {
          id: "rc-a3",
          time: "Yesterday, 4:41 pm",
          title: "Noted a supplier invoice",
          detail: "Northfield Mill’s invoice for £186 is due on Tuesday. Added to invoices and payments."
        },
        {
          id: "rc-a4",
          time: "Yesterday, 11:08 am",
          title: "Filed newsletters",
          detail: "Six newsletters were tucked away so they would not sit in the main inbox."
        },
        {
          id: "rc-a5",
          time: "Wed, 9:20 am",
          title: "Confirmed the school visit request",
          detail: "Logged the bakery visit request and is waiting for you to choose Thursday or keep Friday."
        }
      ],
      settings: {
        digestTime: "07:00",
        digestAddress: "owner@riseandcrumb.example",
        notifyReplies: true,
        notifyInvoices: true,
        notifyBookings: true
      }
    },
    {
      id: "oak-and-pipe",
      name: "Oak & Pipe Plumbing",
      shortName: "Oak & Pipe",
      type: "Plumbing",
      agent: {
        name: "Oak & Pipe Assistant",
        status: "Active",
        managedBy: "Managed by your AI agent",
        since: "January 2026"
      },
      emails: [
        {
          id: "op-1",
          address: "jobs@oakandpipe.example",
          provider: "Gmail",
          status: "Connected",
          linkedOn: "8 January 2026"
        },
        {
          id: "op-2",
          address: "accounts@oakandpipe.example",
          provider: "Outlook",
          status: "Connected",
          linkedOn: "8 January 2026"
        }
      ],
      overview: {
        intro: "A busier day than usual, with a couple of urgent call-outs sitting at the top.",
        categories: [
          {
            id: "needs-reply",
            label: "Needs a reply",
            count: 5,
            tone: "attention",
            summary: "Two boiler call-outs from this morning, a quote follow-up from last week’s bathroom job, a landlord asking for a gas-safety date, and a merchant querying a returned part."
          },
          {
            id: "invoices",
            label: "Invoices and payments",
            count: 4,
            tone: "money",
            summary: "Three job invoices are still unpaid from last week, and a merchant statement is ready to check against yesterday’s van stock."
          },
          {
            id: "bookings",
            label: "Bookings",
            count: 7,
            tone: "calendar",
            summary: "Five jobs already on today’s run, plus two new slot requests for tomorrow morning in the same postcode."
          },
          {
            id: "newsletters",
            label: "Newsletters",
            count: 3,
            tone: "quiet",
            summary: "A trade-price update, a safety bulletin, and a tool promotion. Filed for later."
          }
        ]
      },
      activity: [
        {
          id: "op-a1",
          time: "6:48 am",
          title: "Prepared the daily overview",
          detail: "Read 31 messages and highlighted two boiler call-outs as needing a same-day reply."
        },
        {
          id: "op-a2",
          time: "6:50 am",
          title: "Grouped nearby jobs",
          detail: "Two new booking requests are both in the same postcode as tomorrow’s first job."
        },
        {
          id: "op-a3",
          time: "Yesterday, 5:16 pm",
          title: "Reminded you about unpaid invoices",
          detail: "Three invoices from last week are still open, totalling £1,240."
        },
        {
          id: "op-a4",
          time: "Yesterday, 1:02 pm",
          title: "Drafted a quote follow-up",
          detail: "The bathroom job quoted last Tuesday has had no reply. A short, friendly follow-up is ready."
        },
        {
          id: "op-a5",
          time: "Thu, 8:11 am",
          title: "Filed a safety bulletin",
          detail: "A manufacturer notice was stored with other newsletters so it would not clutter the jobs inbox."
        }
      ],
      settings: {
        digestTime: "06:30",
        digestAddress: "owner@oakandpipe.example",
        notifyReplies: true,
        notifyInvoices: true,
        notifyBookings: true
      }
    },
    {
      id: "willow-and-wave",
      name: "Willow & Wave Salon",
      shortName: "Willow & Wave",
      type: "Hair salon",
      agent: {
        name: "Willow & Wave Assistant",
        status: "Active",
        managedBy: "Managed by your AI agent",
        since: "February 2026"
      },
      emails: [
        {
          id: "ww-1",
          address: "hello@willowandwave.example",
          provider: "Gmail",
          status: "Connected",
          linkedOn: "3 February 2026"
        }
      ],
      overview: {
        intro: "A calm start, with a handful of appointment changes and one supplier invoice to glance at.",
        categories: [
          {
            id: "needs-reply",
            label: "Needs a reply",
            count: 3,
            tone: "attention",
            summary: "A bridal party asking for a trial next Saturday, a colour client with a patch-test question, and a neighbouring café offering a joint late-night event."
          },
          {
            id: "invoices",
            label: "Invoices and payments",
            count: 2,
            tone: "money",
            summary: "The colour-house delivery invoice arrived last night, and this week’s card takings have been paid in."
          },
          {
            id: "bookings",
            label: "Bookings",
            count: 8,
            tone: "calendar",
            summary: "Six appointments are confirmed for today, one client has asked to move to Friday, and a new cut-and-colour request is waiting for a Saturday slot."
          },
          {
            id: "newsletters",
            label: "Newsletters",
            count: 5,
            tone: "quiet",
            summary: "Product launches, a training webinar, and three brand mailings. All filed, nothing urgent."
          }
        ]
      },
      activity: [
        {
          id: "ww-a1",
          time: "7:05 am",
          title: "Prepared the daily overview",
          detail: "Read 18 new messages and summarised today’s chair list alongside the inbox."
        },
        {
          id: "ww-a2",
          time: "7:06 am",
          title: "Noted an appointment change",
          detail: "Priya asked to move her Thursday cut to Friday afternoon. The Friday 3:30 pm slot is still free."
        },
        {
          id: "ww-a3",
          time: "Yesterday, 6:22 pm",
          title: "Flagged a bridal trial request",
          detail: "A wedding party of four would like a trial next Saturday morning. Draft reply is ready."
        },
        {
          id: "ww-a4",
          time: "Yesterday, 10:14 am",
          title: "Recorded this week’s card takings",
          detail: "The weekly payout has landed and was added to invoices and payments."
        },
        {
          id: "ww-a5",
          time: "Tue, 4:40 pm",
          title: "Filed product mailings",
          detail: "Five newsletters were moved out of the main inbox so appointment mail stays easy to see."
        }
      ],
      settings: {
        digestTime: "07:00",
        digestAddress: "owner@willowandwave.example",
        notifyReplies: true,
        notifyInvoices: false,
        notifyBookings: true
      }
    }
  ]
};
