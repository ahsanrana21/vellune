VELLUNE PROFESSIONAL

ONLINE:
Upload the whole folder to your hosting. Open website.html for the storefront and admin.html for Admin.
Keep website.html and admin.html on the same domain/origin so browser storage is shared.

LOCAL TESTING:
Do NOT double-click website.html because browsers block localStorage on file:// pages.
Double-click start_vellune.bat instead. It starts a local server and opens:
http://127.0.0.1:8000/website.html
Admin:
http://127.0.0.1:8000/admin.html

DEFAULT ADMIN PIN: 1234

ORDER FLOW:
Customer -> Add to Cart -> Checkout -> Place Order -> Order Received animation.
On the same origin, the order is saved as vl_o and appears in Admin > Orders.

NEW PRODUCT:
In Admin > Products, tick "Show NEW badge". NEW products automatically move to the top.

PHOTOS:
Up to 4 product photos are supported. The first photo is the main photo and the rest are thumbnails/gallery images.
