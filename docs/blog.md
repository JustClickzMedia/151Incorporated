# Blog

The blog uses the standard WordPress **Posts** (Posts → Add New). Everything loads live from WordPress, so new or edited posts appear without rebuilding the site.

## Homepage: "From the Blog"

- Homepage only, in the footer area under **Upcoming Events** (which is under the "Perseverance Even In The Face Of Darkness" band).
- A carousel of the **12 newest** posts as tiles: featured image, date, title, short description (the post's excerpt) and **Read More**. **Four tiles are visible at a time** on desktop, two on tablets, one (with the next peeking in) on phones; arrows and swipe move through the rest.
- **View All Posts ›** opens the blog page. Each tile opens the post.
- Hidden when there are no published posts.

## Blog page (menu **UPDATE → Blog**, `/blog`)

- All published posts, newest first, with a **List / Grid** toggle (remembered in the visitor's browser).
- Every row or card opens the post. With no posts: "There are no blog posts yet."

## Post page (`/blog/<slug>`)

Title, date, categories, the featured image shown whole (portrait or landscape), the full post, and links back to the blog.

## Writing tips

- Set a **Featured Image** (tiles crop it to 4:3 from the centre; the post page shows it whole).
- The tile description is the post **Excerpt**; if you leave it empty WordPress uses the first ~55 words.
- Author names aren't shown (WordPress user data is private to visitors for security).
