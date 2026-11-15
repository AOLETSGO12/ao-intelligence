/**
 * Demo data for the business (money) dashboard.
 *
 * Everything on business.html is drawn from this file, through the adapter
 * functions in js/connectors.js, so a real set of APIs can later replace
 * those functions without changing the page.
 *
 * This is fictional sample data for the prototype only. It does not come
 * from any live shop, bank, or payments account.
 */
window.BUSINESS_DEMO_DATA = {
  "isDemo": true,
  "demoLabel": "Demo data",
  "currency": "GBP",
  "locale": "en-GB",
  "today": "2026-11-14",
  "todayLabel": "Saturday 14 November 2026",
  "rangeLabel": "Last 30 days",
  "services": [
    {
      "id": "shopify",
      "name": "Shopify",
      "kind": "sales",
      "blurb": "Sales and orders from your online shop or till.",
      "connectLabel": "Connect Shopify"
    },
    {
      "id": "natwest",
      "name": "NatWest",
      "kind": "bank",
      "blurb": "Bank transactions and money coming in.",
      "connectLabel": "Connect NatWest"
    },
    {
      "id": "stripe",
      "name": "Stripe",
      "kind": "payments",
      "blurb": "Card payments and payouts.",
      "connectLabel": "Connect Stripe"
    },
    {
      "id": "square",
      "name": "Square",
      "kind": "payments",
      "blurb": "Counter and card-reader sales.",
      "connectLabel": "Connect Square"
    },
    {
      "id": "xero",
      "name": "Xero",
      "kind": "accounts",
      "blurb": "Invoices and bookkeeping.",
      "connectLabel": "Connect Xero"
    }
  ],
  "businesses": [
    {
      "id": "rise-and-crumb",
      "name": "Rise & Crumb Bakery",
      "shortName": "Rise & Crumb",
      "type": "Bakery",
      "agent": {
        "name": "Rise & Crumb Assistant",
        "status": "Active",
        "managedBy": "Managed by your AI agent",
        "since": "March 2026"
      },
      "connectedServiceIds": [
        "shopify",
        "natwest"
      ],
      "flavor": {
        "unit": "order",
        "unitPlural": "orders",
        "salesNoun": "shop sales",
        "busyHint": "Saturday is usually your busiest shop day.",
        "lagHint": "Card takings often reach the bank the next morning."
      },
      "shopify": {
        "currency": "GBP",
        "daily": [
          {
            "date": "2026-10-16",
            "total": 514.01,
            "orderCount": 43
          },
          {
            "date": "2026-10-17",
            "total": 875.77,
            "orderCount": 85
          },
          {
            "date": "2026-10-18",
            "total": 697.55,
            "orderCount": 69
          },
          {
            "date": "2026-10-19",
            "total": 400.54,
            "orderCount": 36
          },
          {
            "date": "2026-10-20",
            "total": 465.59,
            "orderCount": 45
          },
          {
            "date": "2026-10-21",
            "total": 470.95,
            "orderCount": 45
          },
          {
            "date": "2026-10-22",
            "total": 427.81,
            "orderCount": 41
          },
          {
            "date": "2026-10-23",
            "total": 485.75,
            "orderCount": 45
          },
          {
            "date": "2026-10-24",
            "total": 924.61,
            "orderCount": 78
          },
          {
            "date": "2026-10-25",
            "total": 697.22,
            "orderCount": 66
          },
          {
            "date": "2026-10-26",
            "total": 404.62,
            "orderCount": 41
          },
          {
            "date": "2026-10-27",
            "total": 460.66,
            "orderCount": 42
          },
          {
            "date": "2026-10-28",
            "total": 467.71,
            "orderCount": 47
          },
          {
            "date": "2026-10-29",
            "total": 462.07,
            "orderCount": 46
          },
          {
            "date": "2026-10-30",
            "total": 505.34,
            "orderCount": 41
          },
          {
            "date": "2026-10-31",
            "total": 858.23,
            "orderCount": 86
          },
          {
            "date": "2026-11-01",
            "total": 752.07,
            "orderCount": 66
          },
          {
            "date": "2026-11-02",
            "total": 364.21,
            "orderCount": 34
          },
          {
            "date": "2026-11-03",
            "total": 511.08,
            "orderCount": 42
          },
          {
            "date": "2026-11-04",
            "total": 477.66,
            "orderCount": 48
          },
          {
            "date": "2026-11-05",
            "total": 492.66,
            "orderCount": 44
          },
          {
            "date": "2026-11-06",
            "total": 494.95,
            "orderCount": 48
          },
          {
            "date": "2026-11-07",
            "total": 855.29,
            "orderCount": 83
          },
          {
            "date": "2026-11-08",
            "total": 722.14,
            "orderCount": 64
          },
          {
            "date": "2026-11-09",
            "total": 369.78,
            "orderCount": 39
          },
          {
            "date": "2026-11-10",
            "total": 513.73,
            "orderCount": 46
          },
          {
            "date": "2026-11-11",
            "total": 470.4,
            "orderCount": 43
          },
          {
            "date": "2026-11-12",
            "total": 466.04,
            "orderCount": 44
          },
          {
            "date": "2026-11-13",
            "total": 486.2,
            "orderCount": 47
          },
          {
            "date": "2026-11-14",
            "total": 914.4,
            "orderCount": 84
          }
        ],
        "orders": [
          {
            "id": "rc-o2148",
            "date": "2026-11-14",
            "time": "15:40",
            "reference": "Order #2148",
            "description": "Saturday loaf box and a bag of cinnamon buns",
            "total": 28.5
          },
          {
            "id": "rc-o2147",
            "date": "2026-11-14",
            "time": "14:15",
            "reference": "Order #2147",
            "description": "Birthday cake, vanilla, serves 20",
            "total": 62.0
          },
          {
            "id": "rc-o2146",
            "date": "2026-11-14",
            "time": "11:50",
            "reference": "Order #2146",
            "description": "Café wholesale crate for The Holloway",
            "total": 84.0
          },
          {
            "id": "rc-o2145",
            "date": "2026-11-14",
            "time": "10:05",
            "reference": "Order #2145",
            "description": "Market stall restock — pastries and bloomer loaves",
            "total": 47.8
          },
          {
            "id": "rc-o2144",
            "date": "2026-11-14",
            "time": "08:22",
            "reference": "Order #2144",
            "description": "Morning collection, regular Saturday order",
            "total": 19.4
          },
          {
            "id": "rc-o2101",
            "date": "2026-11-13",
            "time": "16:10",
            "reference": "Order #2101",
            "description": "Office tray bakes for Friday pickup",
            "total": 36.0
          },
          {
            "id": "rc-o2098",
            "date": "2026-11-13",
            "time": "09:18",
            "reference": "Order #2098",
            "description": "Two sourdoughs and a rye",
            "total": 11.7
          },
          {
            "id": "rc-o2054",
            "date": "2026-11-12",
            "time": "13:02",
            "reference": "Order #2054",
            "description": "School fair donation box, cost price",
            "total": 24.0
          }
        ]
      },
      "bank": {
        "currency": "GBP",
        "accountName": "NatWest business current account (demo)",
        "dailyIn": [
          {
            "date": "2026-10-16",
            "total": 489.67
          },
          {
            "date": "2026-10-17",
            "total": 489.72
          },
          {
            "date": "2026-10-18",
            "total": 852.71
          },
          {
            "date": "2026-10-19",
            "total": 658.97
          },
          {
            "date": "2026-10-20",
            "total": 386.52
          },
          {
            "date": "2026-10-21",
            "total": 449.78
          },
          {
            "date": "2026-10-22",
            "total": 444.68
          },
          {
            "date": "2026-10-23",
            "total": 413.75
          },
          {
            "date": "2026-10-24",
            "total": 467.27
          },
          {
            "date": "2026-10-25",
            "total": 875.49
          },
          {
            "date": "2026-10-26",
            "total": 661.9
          },
          {
            "date": "2026-10-27",
            "total": 395.36
          },
          {
            "date": "2026-10-28",
            "total": 437.29
          },
          {
            "date": "2026-10-29",
            "total": 447.24
          },
          {
            "date": "2026-10-30",
            "total": 444.16
          },
          {
            "date": "2026-10-31",
            "total": 481.22
          },
          {
            "date": "2026-11-01",
            "total": 820.39
          },
          {
            "date": "2026-11-02",
            "total": 831.71
          },
          {
            "date": "2026-11-03",
            "total": 344.34
          },
          {
            "date": "2026-11-04",
            "total": 500.23
          },
          {
            "date": "2026-11-05",
            "total": 457.75
          },
          {
            "date": "2026-11-06",
            "total": 575.02
          },
          {
            "date": "2026-11-07",
            "total": 471.68
          },
          {
            "date": "2026-11-08",
            "total": 809.09
          },
          {
            "date": "2026-11-09",
            "total": 696.47
          },
          {
            "date": "2026-11-10",
            "total": 445.26
          },
          {
            "date": "2026-11-11",
            "total": 495.3
          },
          {
            "date": "2026-11-12",
            "total": 454.94
          },
          {
            "date": "2026-11-13",
            "total": 501.8
          },
          {
            "date": "2026-11-14",
            "total": 472.1
          }
        ],
        "transactions": [
          {
            "id": "rc-b114",
            "date": "2026-11-14",
            "time": "07:12",
            "description": "Card payout — shop takings from Friday",
            "amount": 472.1,
            "direction": "in"
          },
          {
            "id": "rc-b113",
            "date": "2026-11-13",
            "time": "07:08",
            "description": "Card payout — shop takings from Thursday",
            "amount": 501.8,
            "direction": "in"
          },
          {
            "id": "rc-b112b",
            "date": "2026-11-12",
            "time": "15:30",
            "description": "Faster Payment to Mill & Co — flour invoice",
            "amount": -214.8,
            "direction": "out"
          },
          {
            "id": "rc-b112",
            "date": "2026-11-12",
            "time": "07:11",
            "description": "Card payout — shop takings from Wednesday",
            "amount": 448.25,
            "direction": "in"
          },
          {
            "id": "rc-b111",
            "date": "2026-11-11",
            "time": "07:09",
            "description": "Card payout — shop takings from Tuesday",
            "amount": 463.4,
            "direction": "in"
          },
          {
            "id": "rc-b110",
            "date": "2026-11-10",
            "time": "09:44",
            "description": "Faster Payment from St Mary's PTA — cake order",
            "amount": 96.0,
            "direction": "in"
          }
        ]
      },
      "stripe": {
        "currency": "GBP",
        "payments": []
      },
      "square": {
        "currency": "GBP",
        "payments": []
      },
      "xero": {
        "currency": "GBP",
        "invoices": []
      }
    },
    {
      "id": "oak-and-pipe",
      "name": "Oak & Pipe Plumbing",
      "shortName": "Oak & Pipe",
      "type": "Plumbing",
      "agent": {
        "name": "Oak & Pipe Assistant",
        "status": "Active",
        "managedBy": "Managed by your AI agent",
        "since": "January 2026"
      },
      "connectedServiceIds": [
        "shopify",
        "natwest"
      ],
      "flavor": {
        "unit": "job",
        "unitPlural": "jobs",
        "salesNoun": "job work",
        "busyHint": "A few larger jobs can make up most of a day’s figure.",
        "lagHint": "Invoice payments often land on a different day from the work itself."
      },
      "shopify": {
        "currency": "GBP",
        "daily": [
          {
            "date": "2026-10-16",
            "total": 335.48,
            "orderCount": 1
          },
          {
            "date": "2026-10-17",
            "total": 222.87,
            "orderCount": 1
          },
          {
            "date": "2026-10-18",
            "total": 245.83,
            "orderCount": 1
          },
          {
            "date": "2026-10-19",
            "total": 259.74,
            "orderCount": 1
          },
          {
            "date": "2026-10-20",
            "total": 427.62,
            "orderCount": 1
          },
          {
            "date": "2026-10-21",
            "total": 1250.5,
            "orderCount": 3
          },
          {
            "date": "2026-10-22",
            "total": 360.14,
            "orderCount": 1
          },
          {
            "date": "2026-10-23",
            "total": 636.11,
            "orderCount": 2
          },
          {
            "date": "2026-10-24",
            "total": 0.0,
            "orderCount": 0
          },
          {
            "date": "2026-10-25",
            "total": 0.0,
            "orderCount": 0
          },
          {
            "date": "2026-10-26",
            "total": 696.94,
            "orderCount": 2
          },
          {
            "date": "2026-10-27",
            "total": 597.3,
            "orderCount": 2
          },
          {
            "date": "2026-10-28",
            "total": 387.86,
            "orderCount": 1
          },
          {
            "date": "2026-10-29",
            "total": 577.08,
            "orderCount": 2
          },
          {
            "date": "2026-10-30",
            "total": 844.85,
            "orderCount": 3
          },
          {
            "date": "2026-10-31",
            "total": 0.0,
            "orderCount": 0
          },
          {
            "date": "2026-11-01",
            "total": 0.0,
            "orderCount": 0
          },
          {
            "date": "2026-11-02",
            "total": 265.05,
            "orderCount": 1
          },
          {
            "date": "2026-11-03",
            "total": 606.2,
            "orderCount": 2
          },
          {
            "date": "2026-11-04",
            "total": 382.42,
            "orderCount": 1
          },
          {
            "date": "2026-11-05",
            "total": 1052.42,
            "orderCount": 3
          },
          {
            "date": "2026-11-06",
            "total": 856.76,
            "orderCount": 2
          },
          {
            "date": "2026-11-07",
            "total": 301.86,
            "orderCount": 1
          },
          {
            "date": "2026-11-08",
            "total": 210.68,
            "orderCount": 1
          },
          {
            "date": "2026-11-09",
            "total": 349.25,
            "orderCount": 1
          },
          {
            "date": "2026-11-10",
            "total": 614.03,
            "orderCount": 2
          },
          {
            "date": "2026-11-11",
            "total": 753.61,
            "orderCount": 2
          },
          {
            "date": "2026-11-12",
            "total": 604.36,
            "orderCount": 2
          },
          {
            "date": "2026-11-13",
            "total": 390.0,
            "orderCount": 2
          },
          {
            "date": "2026-11-14",
            "total": 642.0,
            "orderCount": 3
          }
        ],
        "orders": [
          {
            "id": "op-o884",
            "date": "2026-11-14",
            "time": "16:20",
            "reference": "Job #884",
            "description": "Emergency leak, packed radiator valve, Riverside Close",
            "total": 186.0
          },
          {
            "id": "op-o883",
            "date": "2026-11-14",
            "time": "13:10",
            "reference": "Job #883",
            "description": "New bathroom suite, first-fix plumbing, Hallam Road",
            "total": 276.0
          },
          {
            "id": "op-o882",
            "date": "2026-11-14",
            "time": "09:05",
            "reference": "Job #882",
            "description": "Boiler service and safety check, The Meadows",
            "total": 180.0
          },
          {
            "id": "op-o881",
            "date": "2026-11-13",
            "time": "15:40",
            "reference": "Job #881",
            "description": "Blocked soil pipe, same-day call-out",
            "total": 210.0
          },
          {
            "id": "op-o880",
            "date": "2026-11-13",
            "time": "10:15",
            "reference": "Job #880",
            "description": "Kitchen tap replacement, parts included",
            "total": 180.0
          },
          {
            "id": "op-o878",
            "date": "2026-11-12",
            "time": "11:30",
            "reference": "Job #878",
            "description": "Power flush and inhibitor top-up",
            "total": 264.0
          }
        ]
      },
      "bank": {
        "currency": "GBP",
        "accountName": "NatWest business current account (demo)",
        "dailyIn": [
          {
            "date": "2026-10-16",
            "total": 969.35
          },
          {
            "date": "2026-10-17",
            "total": 325.79
          },
          {
            "date": "2026-10-18",
            "total": 142.25
          },
          {
            "date": "2026-10-19",
            "total": 0.0
          },
          {
            "date": "2026-10-20",
            "total": 0.0
          },
          {
            "date": "2026-10-21",
            "total": 0.0
          },
          {
            "date": "2026-10-22",
            "total": 336.99
          },
          {
            "date": "2026-10-23",
            "total": 293.33
          },
          {
            "date": "2026-10-24",
            "total": 0.0
          },
          {
            "date": "2026-10-25",
            "total": 223.77
          },
          {
            "date": "2026-10-26",
            "total": 0.0
          },
          {
            "date": "2026-10-27",
            "total": 899.09
          },
          {
            "date": "2026-10-28",
            "total": 0.0
          },
          {
            "date": "2026-10-29",
            "total": 810.24
          },
          {
            "date": "2026-10-30",
            "total": 195.67
          },
          {
            "date": "2026-10-31",
            "total": 145.37
          },
          {
            "date": "2026-11-01",
            "total": 313.13
          },
          {
            "date": "2026-11-02",
            "total": 0.0
          },
          {
            "date": "2026-11-03",
            "total": 0.0
          },
          {
            "date": "2026-11-04",
            "total": 0.0
          },
          {
            "date": "2026-11-05",
            "total": 282.78
          },
          {
            "date": "2026-11-06",
            "total": 262.19
          },
          {
            "date": "2026-11-07",
            "total": 177.73
          },
          {
            "date": "2026-11-08",
            "total": 225.15
          },
          {
            "date": "2026-11-09",
            "total": 0.0
          },
          {
            "date": "2026-11-10",
            "total": 145.92
          },
          {
            "date": "2026-11-11",
            "total": 309.01
          },
          {
            "date": "2026-11-12",
            "total": 328.01
          },
          {
            "date": "2026-11-13",
            "total": 156.0
          },
          {
            "date": "2026-11-14",
            "total": 780.0
          }
        ],
        "transactions": [
          {
            "id": "op-b114",
            "date": "2026-11-14",
            "time": "10:42",
            "description": "Faster Payment from N. Okeke — invoice INV-0471",
            "amount": 780.0,
            "direction": "in"
          },
          {
            "id": "op-b113",
            "date": "2026-11-13",
            "time": "14:18",
            "description": "Faster Payment from H. Grant — job #876 balance",
            "amount": 156.0,
            "direction": "in"
          },
          {
            "id": "op-b112b",
            "date": "2026-11-12",
            "time": "08:20",
            "description": "Direct Debit — van insurance",
            "amount": -84.6,
            "direction": "out"
          },
          {
            "id": "op-b111",
            "date": "2026-11-11",
            "time": "16:55",
            "description": "Faster Payment from Riverside Lettings — three jobs",
            "amount": 540.0,
            "direction": "in"
          },
          {
            "id": "op-b109",
            "date": "2026-11-09",
            "time": "11:03",
            "description": "Card payment to PlumbStore — fittings",
            "amount": -127.35,
            "direction": "out"
          },
          {
            "id": "op-b108",
            "date": "2026-11-08",
            "time": "09:27",
            "description": "Faster Payment from C. Adeyemi — invoice INV-0466",
            "amount": 420.0,
            "direction": "in"
          }
        ]
      },
      "stripe": {
        "currency": "GBP",
        "payments": []
      },
      "square": {
        "currency": "GBP",
        "payments": []
      },
      "xero": {
        "currency": "GBP",
        "invoices": []
      }
    },
    {
      "id": "willow-and-wave",
      "name": "Willow & Wave Salon",
      "shortName": "Willow & Wave",
      "type": "Hair salon",
      "agent": {
        "name": "Willow & Wave Assistant",
        "status": "Active",
        "managedBy": "Managed by your AI agent",
        "since": "February 2026"
      },
      "connectedServiceIds": [
        "shopify",
        "natwest"
      ],
      "flavor": {
        "unit": "appointment",
        "unitPlural": "appointments",
        "salesNoun": "chair takings",
        "busyHint": "Friday and Saturday usually carry the week.",
        "lagHint": "Card payouts typically arrive the next morning."
      },
      "shopify": {
        "currency": "GBP",
        "daily": [
          {
            "date": "2026-10-16",
            "total": 793.75,
            "orderCount": 19
          },
          {
            "date": "2026-10-17",
            "total": 800.4,
            "orderCount": 20
          },
          {
            "date": "2026-10-18",
            "total": 235.32,
            "orderCount": 7
          },
          {
            "date": "2026-10-19",
            "total": 164.27,
            "orderCount": 6
          },
          {
            "date": "2026-10-20",
            "total": 558.91,
            "orderCount": 13
          },
          {
            "date": "2026-10-21",
            "total": 542.57,
            "orderCount": 13
          },
          {
            "date": "2026-10-22",
            "total": 615.42,
            "orderCount": 16
          },
          {
            "date": "2026-10-23",
            "total": 790.23,
            "orderCount": 18
          },
          {
            "date": "2026-10-24",
            "total": 780.13,
            "orderCount": 20
          },
          {
            "date": "2026-10-25",
            "total": 284.94,
            "orderCount": 6
          },
          {
            "date": "2026-10-26",
            "total": 182.0,
            "orderCount": 6
          },
          {
            "date": "2026-10-27",
            "total": 499.02,
            "orderCount": 13
          },
          {
            "date": "2026-10-28",
            "total": 516.42,
            "orderCount": 14
          },
          {
            "date": "2026-10-29",
            "total": 666.1,
            "orderCount": 17
          },
          {
            "date": "2026-10-30",
            "total": 804.95,
            "orderCount": 19
          },
          {
            "date": "2026-10-31",
            "total": 806.18,
            "orderCount": 18
          },
          {
            "date": "2026-11-01",
            "total": 247.81,
            "orderCount": 8
          },
          {
            "date": "2026-11-02",
            "total": 150.15,
            "orderCount": 6
          },
          {
            "date": "2026-11-03",
            "total": 558.2,
            "orderCount": 14
          },
          {
            "date": "2026-11-04",
            "total": 484.34,
            "orderCount": 13
          },
          {
            "date": "2026-11-05",
            "total": 605.89,
            "orderCount": 15
          },
          {
            "date": "2026-11-06",
            "total": 805.81,
            "orderCount": 20
          },
          {
            "date": "2026-11-07",
            "total": 808.75,
            "orderCount": 20
          },
          {
            "date": "2026-11-08",
            "total": 271.63,
            "orderCount": 7
          },
          {
            "date": "2026-11-09",
            "total": 165.41,
            "orderCount": 5
          },
          {
            "date": "2026-11-10",
            "total": 515.05,
            "orderCount": 12
          },
          {
            "date": "2026-11-11",
            "total": 509.77,
            "orderCount": 13
          },
          {
            "date": "2026-11-12",
            "total": 655.87,
            "orderCount": 17
          },
          {
            "date": "2026-11-13",
            "total": 816.0,
            "orderCount": 20
          },
          {
            "date": "2026-11-14",
            "total": 728.0,
            "orderCount": 18
          }
        ],
        "orders": [
          {
            "id": "ww-o1190",
            "date": "2026-11-14",
            "time": "16:45",
            "reference": "Booking #1190",
            "description": "Cut and colour, Anna P.",
            "total": 85.0
          },
          {
            "id": "ww-o1189",
            "date": "2026-11-14",
            "time": "15:00",
            "reference": "Booking #1189",
            "description": "Men's cut and beard trim, James L.",
            "total": 32.0
          },
          {
            "id": "ww-o1188",
            "date": "2026-11-14",
            "time": "13:30",
            "reference": "Booking #1188",
            "description": "Balayage and treatment, Priya S.",
            "total": 120.0
          },
          {
            "id": "ww-o1187",
            "date": "2026-11-14",
            "time": "11:15",
            "reference": "Booking #1187",
            "description": "Blow dry and trim, Helen C.",
            "total": 38.0
          },
          {
            "id": "ww-o1186",
            "date": "2026-11-14",
            "time": "09:30",
            "reference": "Booking #1186",
            "description": "Highlights and cut, Maria G.",
            "total": 95.0
          },
          {
            "id": "ww-o1172",
            "date": "2026-11-13",
            "time": "17:10",
            "reference": "Booking #1172",
            "description": "Bridal trial, party of two",
            "total": 150.0
          },
          {
            "id": "ww-o1168",
            "date": "2026-11-13",
            "time": "12:00",
            "reference": "Booking #1168",
            "description": "Cut and blow dry, regular Friday slot",
            "total": 48.0
          },
          {
            "id": "ww-o1140",
            "date": "2026-11-12",
            "time": "14:20",
            "reference": "Booking #1140",
            "description": "Toner and trim",
            "total": 42.0
          }
        ]
      },
      "bank": {
        "currency": "GBP",
        "accountName": "NatWest business current account (demo)",
        "dailyIn": [
          {
            "date": "2026-10-16",
            "total": 492.8
          },
          {
            "date": "2026-10-17",
            "total": 772.0
          },
          {
            "date": "2026-10-18",
            "total": 780.72
          },
          {
            "date": "2026-10-19",
            "total": 94.08
          },
          {
            "date": "2026-10-20",
            "total": 158.83
          },
          {
            "date": "2026-10-21",
            "total": 551.22
          },
          {
            "date": "2026-10-22",
            "total": 541.21
          },
          {
            "date": "2026-10-23",
            "total": 599.78
          },
          {
            "date": "2026-10-24",
            "total": 778.06
          },
          {
            "date": "2026-10-25",
            "total": 775.55
          },
          {
            "date": "2026-10-26",
            "total": 112.24
          },
          {
            "date": "2026-10-27",
            "total": 177.02
          },
          {
            "date": "2026-10-28",
            "total": 496.71
          },
          {
            "date": "2026-10-29",
            "total": 495.43
          },
          {
            "date": "2026-10-30",
            "total": 649.63
          },
          {
            "date": "2026-10-31",
            "total": 782.2
          },
          {
            "date": "2026-11-01",
            "total": 795.27
          },
          {
            "date": "2026-11-02",
            "total": 98.18
          },
          {
            "date": "2026-11-03",
            "total": 143.28
          },
          {
            "date": "2026-11-04",
            "total": 535.67
          },
          {
            "date": "2026-11-05",
            "total": 473.17
          },
          {
            "date": "2026-11-06",
            "total": 597.17
          },
          {
            "date": "2026-11-07",
            "total": 781.52
          },
          {
            "date": "2026-11-08",
            "total": 788.32
          },
          {
            "date": "2026-11-09",
            "total": 103.4
          },
          {
            "date": "2026-11-10",
            "total": 157.19
          },
          {
            "date": "2026-11-11",
            "total": 494.26
          },
          {
            "date": "2026-11-12",
            "total": 505.54
          },
          {
            "date": "2026-11-13",
            "total": 690.0
          },
          {
            "date": "2026-11-14",
            "total": 804.5
          }
        ],
        "transactions": [
          {
            "id": "ww-b114",
            "date": "2026-11-14",
            "time": "07:05",
            "description": "Card payout — chair takings from Friday",
            "amount": 804.5,
            "direction": "in"
          },
          {
            "id": "ww-b113",
            "date": "2026-11-13",
            "time": "07:06",
            "description": "Card payout — chair takings from Thursday",
            "amount": 690.0,
            "direction": "in"
          },
          {
            "id": "ww-b112b",
            "date": "2026-11-12",
            "time": "12:14",
            "description": "Faster Payment to ColourHouse — colour order",
            "amount": -186.4,
            "direction": "out"
          },
          {
            "id": "ww-b112",
            "date": "2026-11-12",
            "time": "07:04",
            "description": "Card payout — chair takings from Wednesday",
            "amount": 612.2,
            "direction": "in"
          },
          {
            "id": "ww-b111",
            "date": "2026-11-11",
            "time": "07:08",
            "description": "Card payout — chair takings from Tuesday",
            "amount": 548.75,
            "direction": "in"
          },
          {
            "id": "ww-b110",
            "date": "2026-11-10",
            "time": "16:40",
            "description": "Faster Payment from Willow Events — bridal deposit",
            "amount": 80.0,
            "direction": "in"
          }
        ]
      },
      "stripe": {
        "currency": "GBP",
        "payments": []
      },
      "square": {
        "currency": "GBP",
        "payments": []
      },
      "xero": {
        "currency": "GBP",
        "invoices": []
      }
    }
  ]
};
