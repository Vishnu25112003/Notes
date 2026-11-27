import Icon from './Icon.jsx';
import { initial } from '../lib/format.js';

export default function ItemAvatar({ item, category, className = 'v-row-icon' }) {
  const title = item?.data?.title;
  if (!title || item.broken) return <span className={className} aria-hidden="true"><Icon name={item?.broken ? 'warning' : category?.icon || 'tag'} size={18} /></span>;
  return <span className={className} aria-hidden="true">{initial(title)}</span>;
}
