// Import all models here to ensure they're registered with Mongoose
// before any service that uses .populate() runs.
import '@/models/Category';
import '@/models/Subcategory';
import '@/models/Product';
import '@/models/User';
import '@/models/Cart';
import '@/models/Order';
import '@/models/HeroSlide';
import '@/models/Otp';
import '@/models/NewsletterSubscriber';
import '@/models/NewsletterCampaign';